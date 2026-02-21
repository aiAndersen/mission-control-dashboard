# Mission Control Dashboard - Technical Documentation

**AI-powered workflow orchestration platform with CEO Agent, visual canvas editor, and comprehensive workflow management.**

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Key Features](#key-features)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [CEO Agent System](#ceo-agent-system)
8. [Workflow Lifecycle](#workflow-lifecycle)
9. [Deployment](#deployment)
10. [Critical Patterns & Learnings](#critical-patterns--learnings)

---

## Overview

**Mission Control Dashboard** is a full-stack workflow orchestration system that allows users to:
- Describe tasks in natural language (CEO Agent)
- Review AI-generated plans with visual canvas view
- Execute, monitor, and manage multi-step workflows
- Track progress across Kanban boards
- Cancel, delete, and duplicate workflows
- View execution history and logs

**Stack:**
- **Frontend**: React 18 + Vite + Tremor UI + React Flow (visual editor)
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Supabase PostgreSQL with real-time subscriptions
- **AI**: OpenAI GPT-5 Mini & GPT-5.2 (planning), Whisper (voice input)
- **Hosting**: Vercel (free tier) + Supabase (free tier)

**Cost:** $0/month (within free tier limits) 🎉

---

## Architecture

### System Design

```
┌─────────────────┐
│   User Browser  │
│   (React SPA)   │
└────────┬────────┘
         │ HTTPS + WebSocket
         ▼
┌─────────────────────────────────────┐
│  Vercel Serverless Functions (CDN)  │
│  ├─ /api/ceo/*                      │
│  ├─ /api/agents/*                   │
│  ├─ /api/workflows/*                │
│  ├─ /api/executions/*               │
│  └─ /api/execution-control/*        │
└────────┬────────────────────────────┘
         │ PostgreSQL + Real-time
         ▼
┌─────────────────────────────────────┐
│    Supabase PostgreSQL Database     │
│  ├─ agents                          │
│  ├─ agent_executions                │
│  ├─ agent_workflows                 │
│  ├─ agent_tasks                     │
│  └─ workflow_approvals              │
└─────────────────────────────────────┘
```

### File Structure

```
mission-control-dashboard/
├── api/                              # Vercel Serverless Functions
│   ├── ceo.js                        # CEO Agent orchestration
│   ├── agents.js                     # Agent management
│   ├── executions.js                 # Execution history
│   ├── execution-control.js          # Runtime control (pause/resume/cancel)
│   └── workflows/                    # Workflow management
│       ├── index.js                  # GET /api/workflows (list)
│       └── [id]/
│           ├── index.js              # GET/DELETE/PATCH /api/workflows/:id
│           └── cancel.js             # POST /api/workflows/:id/cancel
├── frontend/
│   ├── src/
│   │   ├── App.jsx                   # Main dashboard
│   │   ├── components/
│   │   │   ├── WorkflowCreator.jsx   # CEO Agent chat interface
│   │   │   ├── WorkflowMonitor.jsx   # Active workflows view
│   │   │   ├── KanbanBoard.jsx       # Task management
│   │   │   ├── ApprovalGate.jsx      # Human-in-the-loop approvals
│   │   │   ├── ExecutionLog.jsx      # Execution history
│   │   │   └── workflow-editor/
│   │   │       ├── WorkflowCanvas.jsx    # React Flow visual editor
│   │   │       ├── AgentNode.jsx         # Custom workflow step node
│   │   │       ├── TriggerNode.jsx       # Workflow start node
│   │   │       └── conversion.js         # JSON ↔ React Flow conversion
│   │   ├── config/
│   │   │   └── api.js                # API endpoint configuration
│   │   ├── services/
│   │   │   └── supabase.js           # Supabase client + real-time
│   │   └── styles/
│   │       └── workflow-editor.css   # Visual editor styling
│   ├── package.json
│   └── vite.config.js
├── backend/                          # Legacy (migrated to Vercel Functions)
│   └── services/
│       ├── ceoAgent.js               # Workflow planning & execution
│       ├── agentExecution.js         # Python subprocess management
│       └── supabase.js               # Database client
├── database/
│   ├── schema_phase1.sql             # Core tables
│   ├── schema_phase2.sql             # Kanban tasks
│   ├── schema_phase3.sql             # Approvals
│   ├── schema_phase4.sql             # Workflows
│   ├── schema_phase5_visual_editor.sql   # Canvas layout
│   ├── migrations/
│   │   └── add_workflow_task_linkage.sql  # Task-workflow integration
│   ├── seed_core_agents.py           # Agent discovery & seeding
│   └── run-migration.js              # Node.js migration runner
├── vercel.json                       # Vercel deployment config
├── package.json                      # Root dependencies
├── README.md                         # User-facing documentation
└── CLAUDE.md                         # This file (technical docs)
```

---

## Key Features

### 1. **CEO Agent Orchestration**
- **Natural Language Input**: Describe any task (e.g., "Match badge photos to HubSpot attendance records")
- **AI Planning**: GPT-5 Mini generates multi-step workflows with agent assignments
- **Executive Summary**: High-level overview of what the workflow will accomplish
- **Approval Flow**: Review plan before execution (save vs. execute)
- **Voice Input**: Speak your task using Whisper transcription

**Implementation:** [`api/ceo.js`](api/ceo.js), [`backend/services/ceoAgent.js`](backend/services/ceoAgent.js)

### 2. **Visual Workflow Editor**
- **Canvas View**: React Flow node-based visualization
- **Real-time Status**: Nodes update during execution (pending → running → completed/failed)
- **Two Views**: Toggle between List View (cards) and Canvas View (graph)
- **Interactive**: Click nodes to expand details, drag to reposition
- **Auto-layout**: Automatic vertical positioning of workflow steps

**Implementation:** [`frontend/src/components/workflow-editor/WorkflowCanvas.jsx`](frontend/src/components/workflow-editor/WorkflowCanvas.jsx)

### 3. **Workflow Management**
- **Save Without Executing**: Review plans and execute later
- **Execute Saved Workflows**: One-click execution from list
- **Cancel Running Workflows**: Stop mid-execution, mark tasks as blocked
- **Delete Workflows**: Remove with cascade deletion of tasks/executions
- **Duplicate Workflows**: Clone for testing or reuse

**API Endpoints:**
- `POST /api/ceo/plan` - Generate plan only
- `POST /api/ceo/save` - Save plan without executing
- `POST /api/ceo/create` - Create and execute immediately
- `POST /api/ceo/execute` - Alias for /create
- `POST /api/ceo/workflows/:id/execute` - Execute saved workflow
- `DELETE /api/workflows/:id` - Delete workflow
- `POST /api/workflows/:id/cancel` - Cancel running workflow

### 4. **Kanban Task Board**
- **Auto-Task Creation**: Tasks created from workflow steps
- **Status Tracking**: pending → running → completed/failed/blocked
- **Workflow Linkage**: Each task links to parent workflow and execution
- **Real-time Updates**: Tasks update during workflow execution
- **Drag-and-Drop**: (Planned) Manual status updates

**Implementation:** [`frontend/src/components/KanbanBoard.jsx`](frontend/src/components/KanbanBoard.jsx)

### 5. **Approval Gates (Human-in-the-Loop)**
- **Step-level Approvals**: Pause workflow for human review
- **Approval Modal**: Shows context, allows approve/reject with notes
- **Real-time Notifications**: Supabase subscriptions for instant alerts
- **Execution Blocking**: Workflow waits until approved

**Implementation:** [`frontend/src/components/ApprovalGate.jsx`](frontend/src/components/ApprovalGate.jsx)

### 6. **Real-time Progress Tracking**
- **Supabase Subscriptions**: WebSocket connections for instant updates
- **Progress Bars**: Visual progress (Step 3 of 5 - 60%)
- **Status Badges**: Color-coded status indicators
- **Live Execution Log**: Stdout/stderr streaming (future enhancement)

---

## Database Schema

### Core Tables

#### `agents`
Worker agents that execute specific tasks.

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  script_path TEXT NOT NULL,
  tags TEXT[],
  cost_per_execution NUMERIC(10,2) DEFAULT 0,
  avg_duration_seconds INTEGER,
  success_rate NUMERIC(5,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Example agents:**
- `pdf-ocr-parser` - Extract text from PDFs
- `research-scientist` - Web research and analysis
- `hubspot-contact-sync` - Sync contacts to HubSpot
- `database-architect` - Schema design and migrations

#### `agent_workflows`
Multi-step workflows orchestrated by CEO Agent.

```sql
CREATE TABLE agent_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_prompt TEXT NOT NULL,
  workflow_plan JSONB NOT NULL,         -- { steps: [...], name, executive_summary }
  visual_layout JSONB,                  -- { nodeId: {x, y}, ... }
  status TEXT NOT NULL,                 -- planning, saved, running, completed, failed, cancelled
  total_steps INTEGER NOT NULL,
  current_step INTEGER DEFAULT 0,
  executive_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT workflow_status_check
    CHECK (status IN ('planning', 'saved', 'running', 'completed', 'failed', 'cancelled'))
);
```

**workflow_plan JSONB structure:**
```json
{
  "name": "Badge Photo Matching Workflow",
  "executive_summary": "This workflow matches badge photos...",
  "steps": [
    {
      "step_number": 1,
      "agent": "pdf-ocr-parser",
      "agent_id": "uuid...",
      "description": "Extract attendee names from badge PDF",
      "parameters": {
        "--input": "/path/to/badges.pdf",
        "--output": "/tmp/names.json"
      },
      "requires_approval": false
    },
    {
      "step_number": 2,
      "agent": "hubspot-contact-sync",
      "agent_id": "uuid...",
      "description": "Match names to HubSpot contacts",
      "parameters": {
        "--input": "/tmp/names.json"
      },
      "requires_approval": true
    }
  ]
}
```

#### `agent_executions`
Individual agent execution records.

```sql
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES agent_workflows(id) ON DELETE CASCADE,
  step_order INTEGER,
  status TEXT NOT NULL,                 -- pending, running, completed, failed, cancelled
  parameters JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  output TEXT,                          -- Stdout (truncated to 10k chars)
  error_message TEXT,                   -- Stderr
  exit_code INTEGER,

  CONSTRAINT execution_status_check
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);
```

#### `agent_tasks`
Kanban board tasks (linked to workflows).

```sql
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES agent_workflows(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES agent_executions(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id),
  step_order INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,                 -- pending, running, completed, failed, blocked
  priority TEXT,                        -- high, medium, low
  parameters JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT task_status_check
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'blocked'))
);
```

#### `workflow_approvals`
Human-in-the-loop approval gates.

```sql
CREATE TABLE workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES agent_workflows(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  status TEXT NOT NULL,                 -- pending, approved, rejected
  context JSONB,                        -- Step details for reviewer
  approved_by TEXT,
  approval_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,

  CONSTRAINT approval_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'))
);
```

---

## API Endpoints

### CEO Agent (`/api/ceo/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ceo/plan` | POST | Generate workflow plan only (no execution) |
| `/api/ceo/save` | POST | Save workflow plan (status: 'saved') |
| `/api/ceo/create` | POST | Create and execute workflow immediately |
| `/api/ceo/execute` | POST | Alias for /create |
| `/api/ceo/workflows/:id/execute` | POST | Execute saved workflow |
| `/api/ceo/transcribe` | POST | Transcribe audio to text (Whisper) |
| `/api/ceo/workflows/:workflowId/approvals/:approvalId` | PATCH | Approve/reject approval gate |

**Request Examples:**

```javascript
// Generate plan only
POST /api/ceo/plan
{
  "userPrompt": "Match badge photos to HubSpot attendance records"
}

// Response
{
  "plan": {
    "name": "Badge Photo Matching Workflow",
    "executive_summary": "...",
    "steps": [...]
  }
}

// Save workflow (don't execute yet)
POST /api/ceo/save
{
  "prompt": "Match badge photos to HubSpot attendance records"
}

// Execute immediately
POST /api/ceo/execute
{
  "prompt": "Match badge photos to HubSpot attendance records"
}

// Voice transcription
POST /api/ceo/transcribe
{
  "audio": "data:audio/webm;base64,..."
}
// Response: { "text": "Match badge photos..." }
```

### Workflow Management (`/api/workflows/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/workflows` | GET | List workflows (with filtering) |
| `/api/workflows/:id` | GET | Get workflow details |
| `/api/workflows/:id` | DELETE | Delete workflow (cascade) |
| `/api/workflows/:id` | PATCH | Update workflow metadata |
| `/api/workflows/:id/cancel` | POST | Cancel running workflow |

**Vercel File-based Routing:**
- `api/workflows/index.js` → `/api/workflows`
- `api/workflows/[id]/index.js` → `/api/workflows/:id`
- `api/workflows/[id]/cancel.js` → `/api/workflows/:id/cancel`

**Query Parameters (GET /api/workflows):**
- `status` - Filter by status (saved, running, completed, failed, cancelled)
- `search` - Search by workflow name
- `limit` - Max results (default: 50)
- `offset` - Pagination offset

### Agents (`/api/agents/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents` | GET | List all agents |
| `/api/agents/:id/execute` | POST | Execute single agent manually |

### Executions (`/api/executions`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/executions` | GET | List executions (filterable) |

**Query Parameters:**
- `agent_id` - Filter by agent
- `workflow_id` - Filter by workflow
- `limit` - Max results (default: 50)

---

## Frontend Components

### `WorkflowCreator.jsx`
CEO Agent chat interface for creating workflows.

**Features:**
- Text input with submit button
- Voice input with microphone icon (Whisper transcription)
- Plan display with executive summary
- "Approve & Execute" vs "Save for Later" buttons

**State Management:**
- `userPrompt` - Text input value
- `planResult` - AI-generated plan
- `isLoading` - Submission state

### `WorkflowMonitor.jsx`
Active workflows view with list and canvas modes.

**Features:**
- Toggle between List View (cards) and Canvas View (graph)
- Real-time status updates via Supabase subscriptions
- Workflow selector dropdown (canvas mode)
- Action buttons: Execute Now, Cancel, Delete
- Progress bars for running workflows

**State Management:**
- `workflows` - Array of workflow objects
- `selectedWorkflow` - Currently selected workflow
- `viewMode` - 'list' or 'canvas'

### `WorkflowCanvas.jsx`
React Flow visual workflow editor.

**Props:**
- `workflow` - Workflow object with workflow_plan
- `executionStatus` - Map of step_number → status
- `onNodeClick` - Callback for node interactions
- `readOnly` - Disable editing (default: true)

**Features:**
- Converts workflow_plan JSON to React Flow nodes/edges
- Color-coded node borders based on status
- Auto-layout using Dagre algorithm
- Zoom/pan controls
- Minimap (optional)

### `KanbanBoard.jsx`
Task management board with columns.

**Columns:**
- Pending (gray)
- Running (blue)
- Completed (green)
- Failed (red)
- Blocked (orange)

**Features:**
- Real-time task updates via Supabase subscriptions
- Click task card → view execution details
- Shows workflow name, step order, agent
- Drag-and-drop (future enhancement)

### `ApprovalGate.jsx`
Modal for human-in-the-loop approvals.

**Props:**
- `approval` - Approval object with workflow context
- `onApprove(notes)` - Callback for approval
- `onReject(notes)` - Callback for rejection
- `onClose()` - Cancel/close modal

**Features:**
- Shows workflow step details
- Text area for approval notes
- "Approve" and "Reject" buttons
- Closes automatically after action

---

## CEO Agent System

### How CEO Agent Works

1. **User describes task** (natural language or voice)
2. **CEO Agent analyzes** task and determines required steps
3. **CEO Agent assigns agents** to each step based on capabilities
4. **CEO Agent generates plan** with executive summary
5. **User reviews plan** in WorkflowCreator or Canvas view
6. **User approves** ("Execute Now" or "Save for Later")
7. **Workflow executes** step-by-step with progress updates
8. **Approval gates pause** execution for human review (if required)
9. **Workflow completes** or fails with detailed logs

### CEO Agent Prompt Engineering

The CEO Agent uses a structured prompt to generate plans:

```javascript
const systemPrompt = `
You are a CEO Agent responsible for orchestrating multi-agent workflows.

Available agents:
${JSON.stringify(agents, null, 2)}

User task: ${userPrompt}

Generate a workflow plan with:
1. Workflow name (concise, descriptive)
2. Executive summary (2-3 sentences explaining what will be accomplished)
3. Steps (array of step objects):
   - step_number: integer (1, 2, 3...)
   - agent: exact agent name from available agents
   - agent_id: UUID of the agent
   - description: what this step will do
   - parameters: CLI flags as object (e.g., {"--input": "/path", "--limit": 10})
   - requires_approval: boolean (true if human review needed)

Return valid JSON matching this structure:
{
  "name": "Workflow Name",
  "executive_summary": "Summary...",
  "steps": [...]
}
`

const response = await openai.chat.completions.create({
  model: 'gpt-5-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  max_completion_tokens: 2000,
  response_format: { type: 'json_object' }
})
```

**Model Selection:**
- **gpt-5-mini** - Planning & orchestration (fast, cost-effective)
- **gpt-5.2** - Advanced reasoning for complex workflows
- **whisper-1** - Audio transcription

**Critical Pattern:**
- Use `max_completion_tokens` (NOT `max_tokens`) for GPT-5 models
- Never pass `temperature` to GPT-5 models (causes errors)

### Agent Discovery & Capabilities

Agents are discovered by scanning Python scripts and reading CLI help:

```python
# database/seed_core_agents.py
def discover_agents(project_path):
    agents = []
    scripts_dir = os.path.join(project_path, 'scripts')

    for file in os.listdir(scripts_dir):
        if file.endswith('.py'):
            # Extract docstring for description
            # Parse --help output for parameters
            # Detect tags from imports/patterns
            agent = {
                'name': file.replace('.py', ''),
                'script_path': os.path.join(scripts_dir, file),
                'description': extract_docstring(file),
                'tags': detect_tags(file),
                'cost_per_execution': estimate_cost(file)
            }
            agents.append(agent)

    return agents
```

**16 Core Worker Agents:**

| Agent | Purpose | Tags |
|-------|---------|------|
| `architect` | System design & architecture | planning, design |
| `code-executioner` | Code execution & testing | execution, testing |
| `ui-ux-designer` | Interface design | ui, frontend |
| `pdf-ocr-parser` | PDF text extraction | ocr, parsing |
| `research-scientist` | Web research | research, analysis |
| `google-sheets-sync` | Google Sheets API | api, sync, google |
| `hubspot-contact-sync` | HubSpot API | api, sync, hubspot |
| `mailchimp-campaign` | Mailchimp API | api, email, mailchimp |
| `salesforce-lead-import` | Salesforce API | api, crm, salesforce |
| `slack-notification` | Slack messaging | api, notifications, slack |
| `stripe-payment-webhook` | Stripe webhooks | api, payments, stripe |
| `twilio-sms-send` | SMS via Twilio | api, sms, twilio |
| `zapier-webhook-trigger` | Zapier integration | api, automation, zapier |
| `database-architect` | Database design | database, schema |
| `deployment-engineer` | CI/CD & deployment | deployment, devops |
| `qa-tester` | Testing & QA | testing, qa |

---

## Workflow Lifecycle

### Lifecycle States

```
┌─────────────┐
│  planning   │  CEO Agent generating plan
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    saved    │  Plan approved, not executing
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   running   │  Executing steps sequentially
└──────┬──────┘
       │
       ├───────────────────┐
       ▼                   ▼
┌─────────────┐   ┌─────────────┐
│  completed  │   │   failed    │
└─────────────┘   └─────────────┘
```

### Execution Flow

```javascript
// backend/services/ceoAgent.js
async function executeWorkflow(workflowId, plan) {
  // Update status to running
  await supabase
    .from('agent_workflows')
    .update({ status: 'running', current_step: 0 })
    .eq('id', workflowId)

  // Execute each step sequentially
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]

    // Check for approval gate
    if (step.requires_approval) {
      await createApprovalGate(workflowId, step.step_number, step)
      await waitForApproval(workflowId, step.step_number)
    }

    // Execute agent
    const execution = await createExecution(workflowId, step, agent.id)
    await executeAgentInternal(agent.id, execution.id, step.parameters)

    // Update progress
    await supabase
      .from('agent_workflows')
      .update({ current_step: i + 1 })
      .eq('id', workflowId)

    // Update task status
    await supabase
      .from('agent_tasks')
      .update({ status: 'completed' })
      .eq('workflow_id', workflowId)
      .eq('step_order', step.step_number)
  }

  // Mark workflow complete
  await supabase
    .from('agent_workflows')
    .update({ status: 'completed' })
    .eq('id', workflowId)
}
```

### Error Handling

**Race Condition Fix:**
The original implementation had a critical race condition where `executeAgentInternal()` returned before the Python subprocess completed. This caused:
- Workflows stuck at "Step 0 of 5" indefinitely
- Progress never updating
- Infinite polling loops

**Solution:** Wrap `spawn()` in Promise:

```javascript
// BEFORE (BROKEN):
async function executeAgentInternal(agentId, executionId, parameters) {
  const child = spawn('python3', [scriptPath, ...args])

  child.on('close', async (code) => {
    // Database update happens ASYNC - function already returned!
    await supabase.from('agent_executions').update(...)
  })

  return { executionId, pid: child.pid }  // Returns immediately!
}

// AFTER (FIXED):
async function executeAgentInternal(agentId, executionId, parameters) {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [scriptPath, ...args])

    child.on('close', async (code) => {
      const updateData = { status, output, duration_seconds, ... }
      await supabase.from('agent_executions').update(updateData).eq('id', executionId)

      if (code === 0) {
        resolve({ executionId, success: true, output })
      } else {
        reject(new Error(`Agent failed with code ${code}`))
      }
    })

    child.on('error', (err) => reject(err))
  })
}
```

---

## Deployment

### Vercel Serverless Functions

**File-based Routing:**
- `api/ceo.js` → `/api/ceo` (all sub-paths via regex matching)
- `api/workflows/index.js` → `/api/workflows`
- `api/workflows/[id]/index.js` → `/api/workflows/:id`
- `api/workflows/[id]/cancel.js` → `/api/workflows/:id/cancel`

**Dynamic Parameters:**
```javascript
// Vercel passes dynamic path segments in req.query
export default async function handler(req, res) {
  const { id } = req.query  // From [id] in path
  // ...
}
```

**Environment Variables (Vercel CLI):**
```bash
# Add production environment variables
echo -n "https://your-project.supabase.co" | vercel env add VITE_SUPABASE_URL production
echo -n "your-anon-key" | vercel env add VITE_SUPABASE_ANON_KEY production
echo -n "sk-..." | vercel env add OPENAI_API_KEY production

# Critical: Use `echo -n` to avoid newline characters!
# Newlines cause "Invalid value" header errors in Vercel functions
```

**Deployment Flow:**
```bash
# Push to GitHub triggers auto-deploy
git add .
git commit -m "feat: add new feature"
git push origin main

# Vercel automatically:
# 1. Detects push to main
# 2. Runs build (cd frontend && npm install && npm run build)
# 3. Deploys to production
# 4. Updates live URL
```

### Vercel Configuration

**vercel.json:**
```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "npm install",
  "devCommand": "cd frontend && npm run dev"
}
```

**Build Process:**
1. Install root dependencies (api/ functions)
2. Install frontend dependencies
3. Build frontend (Vite)
4. Deploy frontend static files to CDN
5. Deploy API functions to edge network

**Free Tier Limits:**
- ✅ 100 GB bandwidth/month
- ✅ 100 deployments/day
- ✅ 100 GB-hours serverless execution
- ✅ Unlimited API requests
- ✅ Auto-scaling

### Supabase Configuration

**Database:**
- PostgreSQL 15
- 500 MB storage (free tier)
- Direct connections via pooler URL
- SSL required

**Real-time Subscriptions:**
```javascript
// Subscribe to workflow updates
const subscription = supabase
  .channel('workflow_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'agent_workflows'
  }, (payload) => {
    console.log('Workflow updated:', payload.new)
    fetchWorkflows()  // Re-fetch and update UI
  })
  .subscribe()

// Cleanup
return () => {
  supabase.removeChannel(subscription)
}
```

**Row Level Security (RLS):**
Currently disabled for MVP. Future enhancement: add user authentication and RLS policies.

---

## Critical Patterns & Learnings

### 1. **Async/Await with Subprocess**
Always wrap `spawn()` in Promise to properly await completion:
```javascript
return new Promise((resolve, reject) => {
  const child = spawn('python3', [scriptPath, ...args])
  child.on('close', async (code) => {
    // Do database updates BEFORE resolving
    await supabase.from(...).update(...)
    resolve({ success: true })
  })
})
```

### 2. **Vercel Environment Variables**
Use `echo -n` to avoid newlines:
```bash
# ❌ WRONG (adds newline)
echo "value" | vercel env add KEY production

# ✅ CORRECT
echo -n "value" | vercel env add KEY production
```

### 3. **Vercel File-based Routing**
Use explicit file structure instead of catch-all routes:
```
api/workflows/[...path].js  ❌ Doesn't work reliably
api/workflows/[id]/cancel.js  ✅ Works perfectly
```

### 4. **OpenAI GPT-5 Models**
```javascript
// ❌ WRONG (causes errors)
openai.chat.completions.create({
  model: 'gpt-5-mini',
  max_tokens: 2000,        // Don't use max_tokens
  temperature: 0.7         // Don't pass temperature
})

// ✅ CORRECT
openai.chat.completions.create({
  model: 'gpt-5-mini',
  max_completion_tokens: 2000,  // Use max_completion_tokens
  response_format: { type: 'json_object' }
})
```

### 5. **Supabase Real-time Performance**
- Subscribe to specific events (INSERT, UPDATE, DELETE) not all (*)
- Unsubscribe in useEffect cleanup to prevent memory leaks
- Use channel IDs for debugging subscription issues

### 6. **React Flow Integration**
- Convert workflow JSON to nodes/edges in `conversion.js`
- Use Dagre for auto-layout (vertical alignment)
- Store visual positions in `visual_layout` JSONB column
- Update node data without changing layout positions

### 7. **Error Handling Best Practices**
- Log errors with context (workflow ID, step number)
- Return JSON error responses (never HTML)
- Use proper HTTP status codes (404, 500, 400)
- Include error messages in API responses

### 8. **Database CASCADE Deletes**
```sql
workflow_id UUID REFERENCES agent_workflows(id) ON DELETE CASCADE
```
Ensures tasks, executions, approvals are deleted when workflow is deleted.

---

## Future Enhancements

### Planned Features (Phase 7+)
- [ ] Workflow scheduling (cron, specific dates)
- [ ] Webhook triggers for workflows
- [ ] Drag-and-drop workflow editing (add/remove steps)
- [ ] Live stdout streaming during execution
- [ ] Agent marketplace (community-contributed agents)
- [ ] Multi-user support with authentication
- [ ] Row-level security (RLS) for data isolation
- [ ] Workflow templates library
- [ ] Performance analytics dashboard
- [ ] Cost tracking per workflow
- [ ] Notification system (email, Slack)
- [ ] API rate limiting & quotas

---

## Contributing

See [README.md](README.md) for setup instructions.

**Key Files to Understand:**
1. `api/ceo.js` - CEO Agent orchestration logic
2. `backend/services/ceoAgent.js` - Workflow execution engine
3. `frontend/src/components/WorkflowMonitor.jsx` - Main UI
4. `database/schema_phase4.sql` - Core schema

**Adding New Agents:**
```bash
python3 database/seed_core_agents.py
```

**Running Migrations:**
```bash
node backend/run-migration.js
```

---

## License

MIT

---

**Last Updated:** 2026-02-21
**Version:** 6.0 (Phase 6 Complete - Workflow Management)
