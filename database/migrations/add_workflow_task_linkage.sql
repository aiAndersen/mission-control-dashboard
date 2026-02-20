-- Migration: Add workflow linkage to agent_tasks
-- Date: 2026-02-17
-- Purpose: Link tasks to workflows and executions for Kanban integration

-- Add workflow linkage columns
ALTER TABLE agent_tasks
  ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES agent_workflows(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS step_order INTEGER,
  ADD COLUMN IF NOT EXISTS execution_id UUID REFERENCES agent_executions(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS agent_tasks_workflow_id_idx ON agent_tasks(workflow_id);
CREATE INDEX IF NOT EXISTS agent_tasks_execution_id_idx ON agent_tasks(execution_id);

-- Update status enum to match execution statuses
ALTER TABLE agent_tasks
  DROP CONSTRAINT IF EXISTS agent_tasks_status_check;

ALTER TABLE agent_tasks
  ADD CONSTRAINT agent_tasks_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'blocked'));

-- Add comment
COMMENT ON COLUMN agent_tasks.workflow_id IS 'Links task to the workflow that created it';
COMMENT ON COLUMN agent_tasks.step_order IS 'The step number within the workflow (1-indexed)';
COMMENT ON COLUMN agent_tasks.execution_id IS 'Links to the actual execution record when the task runs';
