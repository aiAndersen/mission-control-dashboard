import { createPlan, executeWorkflow, createTasksFromWorkflow } from '../backend/services/ceoAgent.js'
import { supabase } from '../backend/services/supabase.js'

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
    // POST /api/ceo/create - Create and execute workflow
    if (method === 'POST' && path === '/api/ceo/create') {
      const { prompt } = req.body

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' })
      }

      console.log(`[CEO API] Creating workflow from prompt: "${prompt.substring(0, 100)}..."`)

      // Generate plan with CEO Agent
      const plan = await createPlan(prompt)

      // Create workflow record
      const { data: workflow, error: workflowError } = await supabase
        .from('agent_workflows')
        .insert({
          name: plan.name,
          user_prompt: prompt,
          workflow_plan: plan,
          status: 'running',
          total_steps: plan.steps.length,
          current_step: 0,
          executive_summary: plan.executive_summary || null
        })
        .select()
        .single()

      if (workflowError) throw workflowError

      // Create Kanban tasks from workflow steps
      await createTasksFromWorkflow(workflow.id, plan)

      // Execute workflow asynchronously (don't block response)
      executeWorkflow(workflow.id, plan).catch(err => {
        console.error('[CEO API] Workflow execution failed:', err)
      })

      console.log(`[CEO API] ✓ Workflow ${workflow.id} created and executing`)

      return res.status(201).json({
        message: 'Workflow created and executing',
        workflow: {
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          total_steps: workflow.total_steps
        }
      })
    }

    // POST /api/ceo/save - Create workflow without executing
    if (method === 'POST' && path === '/api/ceo/save') {
      const { prompt } = req.body

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' })
      }

      console.log(`[CEO API] Saving workflow (no execution) from prompt: "${prompt.substring(0, 100)}..."`)

      // Generate plan with CEO Agent
      const plan = await createPlan(prompt)

      // Create workflow record with 'saved' status
      const { data: workflow, error: workflowError } = await supabase
        .from('agent_workflows')
        .insert({
          name: plan.name,
          user_prompt: prompt,
          workflow_plan: plan,
          status: 'saved',
          total_steps: plan.steps.length,
          current_step: 0,
          executive_summary: plan.executive_summary || null
        })
        .select()
        .single()

      if (workflowError) throw workflowError

      // Create Kanban tasks from workflow steps
      await createTasksFromWorkflow(workflow.id, plan)

      console.log(`[CEO API] ✓ Workflow ${workflow.id} saved (not executing)`)

      return res.status(201).json({
        message: 'Workflow saved successfully',
        workflow: {
          id: workflow.id,
          name: workflow.name,
          status: workflow.status,
          total_steps: workflow.total_steps,
          plan: plan
        }
      })
    }

    // POST /api/ceo/workflows/:id/execute - Execute saved workflow
    if (method === 'POST' && path.match(/\/api\/ceo\/workflows\/[^/]+\/execute$/)) {
      const workflowId = path.split('/')[4]

      console.log(`[CEO API] Executing saved workflow: ${workflowId}`)

      // Get workflow
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

      // Update status to running
      await supabase
        .from('agent_workflows')
        .update({ status: 'running', current_step: 0 })
        .eq('id', workflowId)

      // Execute workflow asynchronously
      executeWorkflow(workflowId, workflow.workflow_plan).catch(err => {
        console.error('[CEO API] Workflow execution failed:', err)
      })

      console.log(`[CEO API] ✓ Workflow ${workflowId} executing`)

      return res.status(200).json({
        message: 'Workflow execution started',
        workflowId
      })
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('[CEO API] Error:', error)
    return res.status(500).json({
      error: error.message || 'Internal server error'
    })
  }
}
