-- Mission Control Center Database Schema
-- Designed for Supabase free tier (500 MB storage limit)

-- Project registry for cross-project support
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  github_repo TEXT,
  database_url TEXT,  -- Can connect to different Supabase instances
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent registry and configuration
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  script_path TEXT NOT NULL,
  language TEXT DEFAULT 'python',
  parameters JSONB DEFAULT '{}',  -- {--limit: 20, --model: "gpt-5.2"}
  default_schedule TEXT,           -- "0 7 * * *" cron format
  tags TEXT[],                     -- ["enrichment", "python", "expensive"]
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, name)
);

-- Agent execution tracking (keep logs to 1000 chars for free tier)
CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  output_summary TEXT,            -- First 1000 chars of stdout
  error_message TEXT,
  cost_usd NUMERIC(8, 4) DEFAULT 0,
  cost_breakdown JSONB,           -- {openai: 0.25, total: 0.25}
  triggered_by TEXT DEFAULT 'manual',  -- 'manual', 'schedule', 'webhook'
  parameters_used JSONB,          -- Actual params that ran
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent configuration overrides (UI-managed)
CREATE TABLE IF NOT EXISTS agent_config_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  key TEXT NOT NULL,              -- "--model", "--limit", "--force"
  value TEXT NOT NULL,
  expires_at TIMESTAMP,           -- Temporary overrides
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, key)
);

-- Kanban task status
CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  title TEXT NOT NULL,
  status TEXT CHECK (status IN ('backlog', 'queued', 'in_progress', 'completed', 'blocked')) DEFAULT 'backlog',
  execution_id UUID REFERENCES agent_executions(id),
  priority INTEGER DEFAULT 0,     -- Higher = more urgent
  due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS agents_project_idx ON agents(project_id);
CREATE INDEX IF NOT EXISTS agents_tags_idx ON agents USING GIN(tags);
CREATE INDEX IF NOT EXISTS executions_agent_status_idx ON agent_executions(agent_id, status);
CREATE INDEX IF NOT EXISTS executions_created_idx ON agent_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS executions_agent_recent ON agent_executions(agent_id, created_at DESC)
  WHERE status IN ('running', 'pending');
CREATE INDEX IF NOT EXISTS executions_cost_idx ON agent_executions(agent_id, cost_usd);

-- Function to auto-archive old executions (keep under 500 MB free tier limit)
CREATE OR REPLACE FUNCTION archive_old_executions()
RETURNS void AS $$
BEGIN
  -- Archive executions older than 90 days by truncating output
  UPDATE agent_executions
  SET output_summary = LEFT(output_summary, 100) || '... [archived]'
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND LENGTH(output_summary) > 100;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE projects IS 'Registry of all projects using Mission Control';
COMMENT ON TABLE agents IS 'Registry of all available agents across projects';
COMMENT ON TABLE agent_executions IS 'Execution history with truncated logs to stay under free tier limits';
COMMENT ON TABLE agent_config_overrides IS 'UI-managed parameter overrides with optional expiry';
COMMENT ON TABLE agent_tasks IS 'Kanban board task tracking';
