# 🚀 Mission Control Dashboard

**AI-powered workflow orchestration platform** - Describe any task in natural language, get an AI-generated plan, and watch it execute automatically.

[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase)](https://supabase.com)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react)](https://reactjs.org)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Live Demo:** [https://mission-control-dashboard-coral.vercel.app](https://mission-control-dashboard-coral.vercel.app)

---

## ✨ Features

###🤖 CEO Agent Orchestration
- **Natural Language Input**: Describe any task (e.g., *"Match badge photos to HubSpot attendance records"*)
- **AI Planning**: GPT-5 generates multi-step workflows with smart agent assignments
- **Executive Summaries**: High-level overview of what will be accomplished
- **Voice Input**: Speak your task using Whisper transcription

### 📊 Visual Workflow Editor
- **Canvas View**: React Flow node-based visualization with real-time status updates
- **List View**: Card-based workflow display with progress bars
- **Interactive**: Click nodes to expand details, toggle between views

### 🎯 Workflow Management
- **Save Without Executing**: Review plans and execute later
- **Execute Saved Workflows**: One-click execution from dashboard
- **Cancel Running Workflows**: Stop mid-execution with graceful cleanup
- **Delete Workflows**: Remove completed/failed workflows
- **Duplicate Workflows**: Clone for testing or reuse (coming soon)

### 📋 Kanban Task Board
- **Auto-Task Creation**: Tasks automatically created from workflow steps
- **Real-time Updates**: Tasks update during workflow execution
- **Status Tracking**: pending → running → completed/failed/blocked
- **Workflow Linkage**: Each task links to parent workflow

### 🔐 Approval Gates (Human-in-the-Loop)
- **Step-level Approvals**: Pause workflow for human review
- **Approval Modal**: Shows context, allows approve/reject with notes
- **Real-time Notifications**: Instant alerts via WebSocket

### 📈 Real-time Progress Tracking
- **Live Updates**: WebSocket subscriptions for instant status changes
- **Progress Bars**: Visual progress (Step 3 of 5 - 60%)
- **Status Badges**: Color-coded indicators
- **Execution History**: Complete logs for every workflow

---

## 🚀 Quick Start

See **[CLAUDE.md](CLAUDE.md)** for detailed technical documentation, architecture, and API reference.

### Prerequisites
- Node.js 18+
- Supabase account (free tier)
- Vercel account (free tier)
- OpenAI API key

### 1. Clone & Install

```bash
git clone https://github.com/aiAndersen/mission-control-dashboard.git
cd mission-control-dashboard
npm install
cd frontend && npm install
```

### 2. Database Setup

Create Supabase project at [supabase.com](https://supabase.com), then run migrations:

```bash
export DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Run all migrations
psql $DATABASE_URL < database/schema_phase1.sql
psql $DATABASE_URL < database/schema_phase2.sql
psql $DATABASE_URL < database/schema_phase3.sql
psql $DATABASE_URL < database/schema_phase4.sql
psql $DATABASE_URL < database/schema_phase5_visual_editor.sql
psql $DATABASE_URL < database/migrations/add_workflow_task_linkage.sql
```

### 3. Seed Agents

```bash
cd database
pip3 install psycopg2-binary python-dotenv
python3 seed_core_agents.py
```

### 4. Environment Variables

```bash
# frontend/.env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# backend/.env (for local dev)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://...
```

### 5. Run Locally

```bash
cd frontend
npm run dev
# Visit http://localhost:5173
```

---

## 📦 Deploy to Vercel (Free)

### GitHub Auto-Deploy

1. Push to GitHub
2. Connect repository at [vercel.com](https://vercel.com)
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
4. Deploy!

**Auto-deploy enabled:** Push to `main` → Auto-deployment

### Vercel CLI

```bash
npm install -g vercel
vercel login

# Add env variables (use echo -n to avoid newlines!)
echo -n "https://your-project.supabase.co" | vercel env add VITE_SUPABASE_URL production
echo -n "your-anon-key" | vercel env add VITE_SUPABASE_ANON_KEY production
echo -n "sk-..." | vercel env add OPENAI_API_KEY production

# Deploy
vercel --prod
```

---

## 🎯 Usage

### Create a Workflow

1. Open dashboard
2. Type or speak your task: *"Match badge photos to HubSpot attendance records"*
3. Review AI-generated plan
4. Choose "Approve & Execute" or "Save for Later"

### Manage Workflows

- **List View**: Card-based display with progress
- **Canvas View**: Visual node graph (toggle with icon)
- **Execute**: Click "Execute Now" on saved workflows
- **Cancel**: Click "Cancel" on running workflows (red button)
- **Delete**: Click "Delete" on completed/failed workflows (gray button)

### Monitor Tasks

- View Kanban board for all tasks
- Click task to see execution details
- Filter by status

---

## 📐 Architecture

```
User Browser (React) → Vercel Serverless Functions → Supabase PostgreSQL
                    ↘  WebSocket Real-time ↗
```

**Tech Stack:**
- Frontend: React 18 + Vite + Tremor UI + React Flow
- Backend: Vercel Serverless Functions (Node.js)
- Database: Supabase PostgreSQL (free tier)
- AI: OpenAI GPT-5 Mini/5.2, Whisper
- Cost: **$0/month** 🎉

---

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Complete technical docs, architecture, API reference
- **[README.md](README.md)** - This file (quick start)
- **Database Schemas** - `database/schema_phase*.sql`

---

## 🔧 Troubleshooting

### Database Connection Errors
```bash
psql $DATABASE_URL -c "SELECT NOW();"  # Test connection
```

### API 404 Errors
Check Vercel function logs:
```bash
vercel logs https://your-deployment-url.vercel.app
```

### Build Errors
```bash
cd frontend
rm -rf node_modules package-lock.json dist
npm install && npm run build
```

---

## 🚧 Roadmap

- [ ] Workflow scheduling (cron, dates)
- [ ] Webhook triggers
- [ ] Drag-and-drop editor (add/remove steps)
- [ ] Live stdout streaming
- [ ] Agent marketplace
- [ ] Multi-user auth
- [ ] Workflow templates
- [ ] Cost tracking
- [ ] Notifications (email, Slack)

---

## 📄 License

MIT - See [LICENSE](LICENSE)

---

**Built with ❤️ for SchooLinks**

**Last Updated:** 2026-02-21 | **Version:** 6.0
