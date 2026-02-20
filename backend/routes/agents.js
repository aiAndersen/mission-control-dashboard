import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// GET /api/agents - List all agents
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select(`
        *,
        project:projects(name, github_repo, database_url)
      `)
      .order('name')

    if (error) throw error
    res.json({ agents: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/agents/:id - Get single agent
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agents')
      .select(`
        *,
        project:projects(name, github_repo, database_url)
      `)
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Agent not found' })

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/agents/:id/execute - Trigger agent execution
router.post('/:id/execute', async (req, res) => {
  try {
    const { id } = req.params
    const { parameters = {} } = req.body

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select(`
        *,
        project:projects(*)
      `)
      .eq('id', id)
      .single()

    if (agentError) throw agentError
    if (!agent) return res.status(404).json({ error: 'Agent not found' })

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from('agent_executions')
      .insert({
        agent_id: agent.id,
        status: 'pending',
        triggered_by: 'api',
        parameters_used: { ...agent.parameters, ...parameters },
      })
      .select()
      .single()

    if (execError) throw execError

    // Start execution in background
    executeAgent(execution.id, agent, parameters)

    res.json({
      execution_id: execution.id,
      status: 'pending',
      message: 'Agent execution started',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Background execution function
async function executeAgent(executionId, agent, parameters) {
  try {
    // Update status to running
    await supabase
      .from('agent_executions')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', executionId)

    // Build command
    const projectPath = process.env.MARKETING_PORTAL_PATH ||
      '/Users/andrewandersen/Desktop/Marketing Content Database/marketing-content-portal'

    const scriptPath = path.join(projectPath, agent.script_path)

    const args = Object.entries(parameters).flatMap(([key, value]) =>
      [key, String(value)]
    )

    // Execute agent
    const startTime = Date.now()
    const child = spawn('python3', [scriptPath, ...args], {
      cwd: projectPath,
      env: { ...process.env }
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', async (code) => {
      const duration = Math.round((Date.now() - startTime) / 1000)
      const status = code === 0 ? 'completed' : 'failed'

      // Update execution record (truncate output to 1000 chars for free tier)
      await supabase
        .from('agent_executions')
        .update({
          status,
          completed_at: new Date().toISOString(),
          duration_seconds: duration,
          output_summary: (stdout + stderr).slice(0, 1000),
          error_message: code !== 0 ? `Exit code ${code}` : null,
        })
        .eq('id', executionId)

      console.log(`✓ Execution ${executionId} ${status} (${duration}s)`)
    })

  } catch (err) {
    // Update to failed
    await supabase
      .from('agent_executions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: err.message,
      })
      .eq('id', executionId)

    console.error(`✗ Execution ${executionId} failed:`, err)
  }
}

export default router
