import express from 'express'
import dotenv from 'dotenv'
import multer from 'multer'
import OpenAI from 'openai'
import { File } from 'buffer'
import ceoAgent from '../services/ceoAgent.js'
import { supabase } from '../services/supabase.js'

dotenv.config()

const router = express.Router()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY?.trim() })

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
})

/**
 * POST /api/ceo/plan
 * Plan a workflow from user's natural language prompt
 * Uses GPT-5.2 to generate multi-step plan
 */
router.post('/plan', async (req, res) => {
  try {
    const { userPrompt } = req.body

    if (!userPrompt) {
      return res.status(400).json({ error: 'userPrompt is required' })
    }

    console.log(`\n[CEO API] Planning workflow for: "${userPrompt}"`)

    // Get available agents from database
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .order('name')

    if (agentsError) throw agentsError

    // Use CEO Agent to plan workflow
    const plan = await ceoAgent.planWorkflow(userPrompt, agents || [])

    res.json({
      success: true,
      plan,
      message: `Workflow plan created: ${plan.workflow_name}`
    })

  } catch (error) {
    console.error('[CEO API] Error planning workflow:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/ceo/transcribe
 * Transcribe audio to text using OpenAI Whisper
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    console.log(`[CEO API] Transcribing audio (${req.file.size} bytes)`)

    // Create a File object from the buffer
    const audioFile = new File([req.file.buffer], req.file.originalname || 'audio.webm', {
      type: req.file.mimetype || 'audio/webm'
    })

    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'text'
    })

    console.log(`[CEO API] Transcription successful: "${transcription.substring(0, 100)}..."`)

    res.json({
      success: true,
      text: transcription
    })

  } catch (error) {
    console.error('[CEO API] Error transcribing audio:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/ceo/execute
 * Execute a planned workflow
 * Creates workflow record and triggers CEO Agent orchestration
 */
router.post('/execute', async (req, res) => {
  try {
    const { plan, userPrompt } = req.body

    if (!plan || !userPrompt) {
      return res.status(400).json({ error: 'plan and userPrompt are required' })
    }

    console.log(`\n[CEO API] Executing workflow: ${plan.workflow_name}`)

    // Create workflow record in database
    const { data: workflow, error: workflowError } = await supabase
      .from('agent_workflows')
      .insert({
        name: plan.workflow_name,
        user_prompt: userPrompt,
        total_steps: plan.steps?.length || 0,
        workflow_plan: plan,
        status: 'running'
      })
      .select()
      .single()

    if (workflowError) throw workflowError

    // Create Kanban tasks from workflow steps
    await ceoAgent.createTasksFromWorkflow(workflow.id, plan)

    // Execute workflow asynchronously (don't block response)
    ceoAgent.executeWorkflow(workflow.id, plan)
      .then(() => {
        console.log(`[CEO API] ✓ Workflow ${workflow.id} completed`)
      })
      .catch((error) => {
        console.error(`[CEO API] ✗ Workflow ${workflow.id} failed:`, error)
      })

    res.json({
      success: true,
      workflowId: workflow.id,
      status: 'running',
      message: `Workflow execution started: ${plan.workflow_name}`
    })

  } catch (error) {
    console.error('[CEO API] Error executing workflow:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/ceo/save
 * Save a planned workflow without executing
 * Creates workflow record with status 'saved'
 */
router.post('/save', async (req, res) => {
  try {
    const { plan, userPrompt } = req.body

    if (!plan || !userPrompt) {
      return res.status(400).json({ error: 'plan and userPrompt are required' })
    }

    console.log(`\n[CEO API] Saving workflow: ${plan.workflow_name}`)

    // Create workflow record in database with 'saved' status
    const { data: workflow, error: workflowError } = await supabase
      .from('agent_workflows')
      .insert({
        name: plan.workflow_name,
        user_prompt: userPrompt,
        total_steps: plan.steps?.length || 0,
        workflow_plan: plan,
        status: 'saved',
        executive_summary: plan.reasoning || null
      })
      .select()
      .single()

    if (workflowError) throw workflowError

    // Create Kanban tasks from workflow steps
    await ceoAgent.createTasksFromWorkflow(workflow.id, plan)

    console.log(`[CEO API] ✓ Workflow ${workflow.id} saved (not executing)`)

    res.json({
      success: true,
      workflowId: workflow.id,
      status: 'saved',
      message: `Workflow saved: ${plan.workflow_name}`
    })

  } catch (error) {
    console.error('[CEO API] Error saving workflow:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/ceo/workflows/:id/execute
 * Execute a saved workflow
 */
router.post('/workflows/:id/execute', async (req, res) => {
  try {
    const { id } = req.params

    console.log(`\n[CEO API] Executing saved workflow: ${id}`)

    // Get workflow from database
    const { data: workflow, error: getError } = await supabase
      .from('agent_workflows')
      .select('*')
      .eq('id', id)
      .single()

    if (getError) throw getError
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' })
    }

    // Check if workflow is in 'saved' status
    if (workflow.status !== 'saved') {
      return res.status(400).json({
        error: `Workflow cannot be executed. Current status: ${workflow.status}`
      })
    }

    // Update workflow status to 'running'
    const { error: updateError } = await supabase
      .from('agent_workflows')
      .update({
        status: 'running',
        completed_steps: 0
      })
      .eq('id', id)

    if (updateError) throw updateError

    // Execute workflow asynchronously
    ceoAgent.executeWorkflow(id, workflow.workflow_plan)
      .then(() => {
        console.log(`[CEO API] ✓ Workflow ${id} completed`)
      })
      .catch((error) => {
        console.error(`[CEO API] ✗ Workflow ${id} failed:`, error)
      })

    res.json({
      success: true,
      workflowId: id,
      status: 'running',
      message: `Workflow execution started: ${workflow.name}`
    })

  } catch (error) {
    console.error('[CEO API] Error executing saved workflow:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/ceo/workflows
 * List all CEO-orchestrated workflows
 */
router.get('/workflows', async (req, res) => {
  try {
    const { limit = 50, status } = req.query

    let query = supabase
      .from('agent_workflows')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error

    res.json({ workflows: data || [] })

  } catch (error) {
    console.error('[CEO API] Error listing workflows:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/ceo/workflows/:id
 * Get workflow details with child executions
 */
router.get('/workflows/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Get workflow with child executions
    const { data: workflow, error: workflowError } = await supabase
      .from('agent_workflows')
      .select(`
        *,
        executions:agent_executions(
          *,
          agent:agents(name, description, tags)
        )
      `)
      .eq('id', id)
      .order('step_order', { foreignTable: 'agent_executions', ascending: true })
      .single()

    if (workflowError) throw workflowError

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' })
    }

    res.json({ workflow })

  } catch (error) {
    console.error('[CEO API] Error getting workflow:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PATCH /api/ceo/workflows/:id
 * Update workflow (usually for status changes)
 */
router.patch('/workflows/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    const { data, error } = await supabase
      .from('agent_workflows')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    res.json({ workflow: data })

  } catch (error) {
    console.error('[CEO API] Error updating workflow:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/ceo/workflows/:id
 * Cancel a running workflow
 */
router.delete('/workflows/:id', async (req, res) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from('agent_workflows')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    res.json({
      success: true,
      workflow: data,
      message: 'Workflow cancelled'
    })

  } catch (error) {
    console.error('[CEO API] Error cancelling workflow:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /api/ceo/workflows/:id/approvals
 * Create an approval gate (usually called internally by CEO Agent)
 */
router.post('/workflows/:id/approvals', async (req, res) => {
  try {
    const { id: workflowId } = req.params
    const { approval_type, step_order, prompt, context } = req.body

    const { data, error } = await supabase
      .from('workflow_approvals')
      .insert({
        workflow_id: workflowId,
        approval_type,
        step_order,
        prompt,
        context,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    res.json({ approval: data })

  } catch (error) {
    console.error('[CEO API] Error creating approval:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/ceo/workflows/:id/approvals/latest
 * Get the latest pending approval for a workflow
 */
router.get('/workflows/:id/approvals/latest', async (req, res) => {
  try {
    const { id: workflowId } = req.params

    const { data, error } = await supabase
      .from('workflow_approvals')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {  // PGRST116 = no rows
      throw error
    }

    res.json({ approval: data || null })

  } catch (error) {
    console.error('[CEO API] Error getting latest approval:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * PATCH /api/ceo/workflows/:workflowId/approvals/:approvalId
 * Approve or reject an approval gate
 */
router.patch('/workflows/:workflowId/approvals/:approvalId', async (req, res) => {
  try {
    const { approvalId } = req.params
    const { status, notes, approved_by } = req.body

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be "approved" or "rejected"' })
    }

    const { data, error } = await supabase
      .from('workflow_approvals')
      .update({
        status,
        approved_by,
        notes,
        approved_at: new Date().toISOString()
      })
      .eq('id', approvalId)
      .select()
      .single()

    if (error) throw error

    console.log(`[CEO API] Approval ${status}: ${approvalId}`)

    res.json({
      success: true,
      approval: data,
      message: `Approval ${status}`
    })

  } catch (error) {
    console.error('[CEO API] Error updating approval:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
