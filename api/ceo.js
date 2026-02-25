import ceoAgent from '../backend/services/ceoAgent.js'
import { supabase } from '../backend/services/supabase.js'

/**
 * Fetch agents from DB and generate a workflow plan via the CEO Agent.
 * Returns the raw plan object from ceoAgent.planWorkflow (uses workflow_name, reasoning, steps, etc.)
 */
async function createPlan(userPrompt) {
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, description, tags')

  const availableAgents = agents || []
  return ceoAgent.planWorkflow(userPrompt, availableAgents)
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { method, url } = req
  const path = url.split('?')[0]

  try {
    // POST /api/ceo/plan - Generate plan only, return to frontend for review
    if (method === 'POST' && path === '/api/ceo/plan') {
      const { userPrompt } = req.body || {}

      if (!userPrompt) {
        return res.status(400).json({ error: 'User prompt is required' })
      }

      console.log(`[CEO API] Generating plan for: "${userPrompt.substring(0, 100)}..."`)

      const plan = await createPlan(userPrompt)

      return res.status(200).json({ plan })
    }

    // POST /api/ceo/execute - User approved plan, save and execute immediately
    // Frontend sends { plan, userPrompt } with the pre-reviewed plan
    if (method === 'POST' && path === '/api/ceo/execute') {
      const { plan, userPrompt } = req.body || {}

      if (!plan || !userPrompt) {
        return res.status(400).json({ error: 'Plan and userPrompt are required' })
      }

      const workflowName = plan.workflow_name || plan.name || 'Untitled Workflow'
      const summary = plan.executive_summary || plan.reasoning || null

      console.log(`[CEO API] Executing approved workflow: "${workflowName}"`)

      const { data: workflow, error: workflowError } = await supabase
        .from('agent_workflows')
        .insert({
          name: workflowName,
          user_prompt: userPrompt,
          workflow_plan: plan,
          status: 'running',
          total_steps: plan.steps?.length || 0,
          current_step: 0,
          executive_summary: summary
        })
        .select()
        .single()

      if (workflowError) throw workflowError

      await ceoAgent.createTasksFromWorkflow(workflow.id, plan)

      ceoAgent.executeWorkflow(workflow.id, plan).catch(err => {
        console.error('[CEO API] Workflow execution failed:', err)
      })

      return res.status(201).json({
        message: 'Workflow created and executing',
        workflowId: workflow.id,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          total_steps: workflow.total_steps
        }
      })
    }

    // POST /api/ceo/save - User approved plan, save without executing
    // Frontend sends { plan, userPrompt } with the pre-reviewed plan
    if (method === 'POST' && path === '/api/ceo/save') {
      const { plan, userPrompt } = req.body || {}

      if (!plan || !userPrompt) {
        return res.status(400).json({ error: 'Plan and userPrompt are required' })
      }

      const workflowName = plan.workflow_name || plan.name || 'Untitled Workflow'
      const summary = plan.executive_summary || plan.reasoning || null

      console.log(`[CEO API] Saving approved workflow: "${workflowName}"`)

      const { data: workflow, error: workflowError } = await supabase
        .from('agent_workflows')
        .insert({
          name: workflowName,
          user_prompt: userPrompt,
          workflow_plan: plan,
          status: 'saved',
          total_steps: plan.steps?.length || 0,
          current_step: 0,
          executive_summary: summary
        })
        .select()
        .single()

      if (workflowError) throw workflowError

      await ceoAgent.createTasksFromWorkflow(workflow.id, plan)

      console.log(`[CEO API] ✓ Workflow ${workflow.id} saved (not executing)`)

      return res.status(201).json({
        message: 'Workflow saved successfully',
        workflowId: workflow.id,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          total_steps: workflow.total_steps
        }
      })
    }

    // POST /api/ceo/create - Generate plan and execute (programmatic / legacy use)
    if (method === 'POST' && path === '/api/ceo/create') {
      const { prompt } = req.body || {}

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' })
      }

      console.log(`[CEO API] Creating workflow from prompt: "${prompt.substring(0, 100)}..."`)

      const plan = await createPlan(prompt)
      const workflowName = plan.workflow_name || plan.name || 'Untitled Workflow'
      const summary = plan.executive_summary || plan.reasoning || null

      const { data: workflow, error: workflowError } = await supabase
        .from('agent_workflows')
        .insert({
          name: workflowName,
          user_prompt: prompt,
          workflow_plan: plan,
          status: 'running',
          total_steps: plan.steps?.length || 0,
          current_step: 0,
          executive_summary: summary
        })
        .select()
        .single()

      if (workflowError) throw workflowError

      await ceoAgent.createTasksFromWorkflow(workflow.id, plan)

      ceoAgent.executeWorkflow(workflow.id, plan).catch(err => {
        console.error('[CEO API] Workflow execution failed:', err)
      })

      console.log(`[CEO API] ✓ Workflow ${workflow.id} created and executing`)

      return res.status(201).json({
        message: 'Workflow created and executing',
        workflowId: workflow.id,
        workflow: {
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          total_steps: workflow.total_steps
        }
      })
    }

    // POST /api/ceo/workflows/:id/execute - Execute a saved workflow
    if (method === 'POST' && path.match(/\/api\/ceo\/workflows\/[^/]+\/execute$/)) {
      const workflowId = path.split('/')[4]

      console.log(`[CEO API] Executing saved workflow: ${workflowId}`)

      const { data: workflow, error: fetchError } = await supabase
        .from('agent_workflows')
        .select('*')
        .eq('id', workflowId)
        .single()

      if (fetchError || !workflow) {
        return res.status(404).json({ error: 'Workflow not found' })
      }

      if (workflow.status !== 'saved') {
        return res.status(400).json({ error: 'Workflow is not in saved status' })
      }

      await supabase
        .from('agent_workflows')
        .update({ status: 'running', current_step: 0 })
        .eq('id', workflowId)

      ceoAgent.executeWorkflow(workflowId, workflow.workflow_plan).catch(err => {
        console.error('[CEO API] Workflow execution failed:', err)
      })

      console.log(`[CEO API] ✓ Workflow ${workflowId} executing`)

      return res.status(200).json({
        message: 'Workflow execution started',
        workflowId
      })
    }

    // Approval endpoints: PATCH /api/ceo/workflows/:workflowId/approvals/:approvalId
    if (method === 'PATCH' && path.match(/\/api\/ceo\/workflows\/[^/]+\/approvals\/[^/]+$/)) {
      const parts = path.split('/')
      const workflowId = parts[4]
      const approvalId = parts[6]
      const { status, notes } = req.body || {}

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be approved or rejected' })
      }

      const { error: updateError } = await supabase
        .from('workflow_approvals')
        .update({
          status,
          approval_notes: notes || null,
          resolved_at: new Date().toISOString()
        })
        .eq('id', approvalId)
        .eq('workflow_id', workflowId)

      if (updateError) throw updateError

      return res.status(200).json({ message: `Approval ${status}` })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    // Log full error server-side only — never expose raw SDK errors (may contain API keys) to client
    console.error('[CEO API] Error:', error.message)
    const isAuthError = error.status === 401 || error.message?.includes('API key') || error.message?.includes('header value')
    return res.status(500).json({
      error: isAuthError ? 'AI service configuration error. Contact support.' : 'Internal server error'
    })
  }
}
