# Mission Control Center

**AI Agent orchestration dashboard** for monitoring, configuring, and executing agents across multiple projects.

- ✅ **Free tier deployment** (Vercel + Supabase)
- 🎯 Real-time agent status monitoring
- 🚀 Manual agent execution from UI
- 📊 Execution history tracking
- 🏷️ Agent catalog with auto-discovery

---

## Architecture

- **Frontend**: React 18 + Vite + Tremor (analytics UI)
- **Backend**: Express.js API + Vercel Functions
- **Database**: Supabase PostgreSQL (free tier: 500 MB)
- **Hosting**: Vercel (free tier)
- **Cost**: **$0/month** 🎉

---

## Quick Start

### 1. Database Setup

#### Create Supabase Project (Free)
1. Go to [supabase.com](https://supabase.com) and create account
2. Create new project (select free tier)
3. Wait for database to provision (~2 minutes)
4. Get your connection details from Settings → Database

#### Run Schema Migration
```bash
cd mission-control-dashboard

# Copy your Supabase connection string
export DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres"

# Install psql if needed (macOS)
brew install postgresql

# Run schema migration
psql $DATABASE_URL < database/schema.sql
```

You should see:
```
CREATE TABLE
CREATE TABLE
...
CREATE INDEX
COMMENT
```

### 2. Seed Agents

Discover agents from your marketing content portal:

```bash
cd mission-control-dashboard

# Install dependencies
pip3 install psycopg2-binary python-dotenv

# Run discovery
python3 database/seed_agents.py \
  --project-name marketing-content-portal \
  --project-path "/Users/andrewandersen/Desktop/Marketing Content Database/marketing-content-portal"
```

Expected output:
```
============================================================
Mission Control Agent Discovery
============================================================

✓ Project registered: marketing-content-portal (uuid...)

Discovering agents in /path/to/portal...
  ✓ Discovered: deploy-preflight (3 tags)
  ✓ Discovered: health-monitor (4 tags)
  ✓ Discovered: diagnose-search (5 tags)
  ✓ Discovered: import-orchestrator (4 tags)
  ✓ Discovered: maintenance-orchestrator (4 tags)
  ✓ Discovered: dedup-content (3 tags)

✓ Agents seeded: 6 inserted, 0 updated
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cat > .env <<EOF
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
EOF

# Start dev server
npm run dev
```

Visit **http://localhost:5173** - you should see 6 agents! 🎉

### 4. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env <<EOF
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://...
MARKETING_PORTAL_PATH=/Users/andrewandersen/Desktop/Marketing Content Database/marketing-content-portal
EOF

# Start API server
npm start
```

API running at **http://localhost:3001**

### 5. Test Execution

Click "Run Now" on any agent in the UI. You should see:
- Alert: "Agent queued for execution!"
- Check database: `SELECT * FROM agent_executions;`
- Status should go: `pending` → `running` → `completed`

---

## Deployment to Vercel with GitHub Auto-Deploy (Free)

### Step 1: GitHub Repository Setup ✅

**Already Done!** Repository is live at:
- **GitHub**: [https://github.com/aiAndersen/mission-control-dashboard](https://github.com/aiAndersen/mission-control-dashboard)

### Step 2: Connect Vercel to GitHub

1. **Go to Vercel Dashboard**
   - Visit [https://vercel.com](https://vercel.com)
   - Login or create account (free tier)

2. **Import GitHub Repository**
   - Click **"Add New Project"**
   - Click **"Import Git Repository"**
   - Select **"mission-control-dashboard"** from your repositories
   - If not visible, click **"Adjust GitHub App Permissions"**

3. **Configure Project Settings**
   - **Framework Preset**: Vite
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: Leave default

4. **Set Environment Variables**
   Add these in the Vercel dashboard (Settings → Environment Variables):

   | Variable | Value | Description |
   |----------|-------|-------------|
   | `SUPABASE_URL` | `https://your-project.supabase.co` | From Supabase Dashboard |
   | `SUPABASE_SERVICE_KEY` | `your-service-role-key` | Settings → API → service_role |
   | `SUPABASE_ANON_KEY` | `your-anon-key` | Settings → API → anon |
   | `DATABASE_URL` | `postgresql://...` | Settings → Database → Connection String |
   | `OPENAI_API_KEY` | `sk-...` | From OpenAI Dashboard |
   | `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Same as SUPABASE_URL |
   | `VITE_SUPABASE_ANON_KEY` | `your-anon-key` | Same as SUPABASE_ANON_KEY |

5. **Deploy**
   - Click **"Deploy"**
   - Wait 2-3 minutes for build
   - ✅ Your dashboard will be live at: **https://mission-control-dashboard.vercel.app**

### Step 3: Enable Auto-Deploy (Already Active!)

**Auto-deploy is automatically enabled when you connect GitHub to Vercel:**

- ✅ **Push to `main`** → Triggers production deployment
- ✅ **Pull requests** → Create preview deployments
- ✅ **Commits** → Show build status in GitHub
- ✅ **Rollbacks** → One-click rollback in Vercel dashboard

**How to Deploy Changes:**
```bash
# Make changes to your code
git add .
git commit -m "feat: add new feature"
git push origin main

# Vercel automatically:
# 1. Detects push to main
# 2. Runs build
# 3. Deploys to production
# 4. Updates https://mission-control-dashboard.vercel.app
```

### Alternative: Manual CLI Deploy

If you prefer CLI deployment:
```bash
npm install -g vercel
vercel login

# Deploy
cd mission-control-dashboard
vercel --prod
```

Your dashboard will be live at: **https://mission-control-dashboard.vercel.app** 🚀

---

## Usage

### View All Agents
```
GET http://localhost:3001/api/agents
```

### Execute Agent
```bash
curl -X POST http://localhost:3001/api/agents/{agent-id}/execute \
  -H "Content-Type: application/json" \
  -d '{"parameters": {"--limit": 10}}'
```

### View Executions
```
GET http://localhost:3001/api/executions?agent_id={agent-id}
```

---

## Project Structure

```
mission-control-dashboard/
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── App.jsx            # Main agent catalog
│   │   ├── services/
│   │   │   └── supabase.js    # Supabase client
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
├── backend/                    # Express API
│   ├── server.js              # Main API server
│   ├── routes/
│   │   ├── agents.js          # GET /agents, POST /agents/:id/execute
│   │   └── executions.js      # GET /executions
│   └── package.json
├── database/
│   ├── schema.sql             # Supabase schema
│   └── seed_agents.py         # Agent discovery script
├── vercel.json                # Deployment config
└── README.md
```

---

## Free Tier Limits

**Vercel Free:**
- ✅ 100 GB bandwidth/month
- ✅ 100 deployments/day
- ✅ 100 GB-hours serverless functions

**Supabase Free:**
- ✅ 500 MB database storage
- ✅ 50k monthly active users
- ✅ 500k Edge Function invocations
- ⚠️ Database pauses after 7 days inactivity (auto-wakes)

**Design Decisions for Free Tier:**
- Execution logs truncated to 1000 chars
- Old executions archived after 90 days
- No real-time stdout streaming (Phase 2)

---

## Troubleshooting

### Database Connection Errors
```bash
# Test connection
psql $DATABASE_URL -c "SELECT NOW();"
```

### Frontend Build Errors
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Agent Discovery Not Finding Scripts
```bash
# Check script paths
ls -la "/Users/andrewandersen/Desktop/Marketing Content Database/marketing-content-portal/scripts/"

# Run with verbose
python3 database/seed_agents.py --project-path /correct/path
```

---

## Phase 1 Complete! ✅

**What Works:**
- ✅ Agent catalog with 6 agents
- ✅ Manual execution from UI
- ✅ Execution history tracking
- ✅ Tag-based organization
- ✅ Free tier deployment

**Next: Phase 2** (Weeks 4-5)
- Kanban board with drag-drop
- Real-time status updates via Supabase Realtime
- Progress bars for in-progress agents
- Live stdout viewer

---

## Contributing

This is an internal tool for managing AI agents across projects. To add a new project:

```bash
python3 database/seed_agents.py \
  --project-name my-new-project \
  --project-path /path/to/project \
  --github-repo https://github.com/user/repo
```

---

## License

MIT
