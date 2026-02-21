import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

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
    // DELETE /api/workflows/:id - Delete workflow and all related records
    if (method === 'DELETE' && path.match(/^\/api\/workflows\/[^/]+$/)) {
      const workflowId = path.split('/')[3]

      console.log(`[Workflows API] Deleting workflow: ${workflowId}`)

      // Delete workflow (CASCADE will handle related executions, tasks, approvals)
      const { error } = await supabase
        .from('agent_workflows')
        .delete()
        .eq('id', workflowId)

      if (error) throw error

      console.log(`[Workflows API] ✓ Workflow ${workflowId} deleted`)

      return res.status(200).json({
        message: 'Workflow deleted successfully',
        workflowId
      })
    }

    // POST /api/workflows/:id/cancel - Cancel running workflow
    if (method === 'POST' && path.match(/^\/api\/workflows\/[^/]+\/cancel$/)) {
      const workflowId = path.split('/')[3]

      console.log(`[Workflows API] Canceling workflow: ${workflowId}`)

      // Update workflow status to cancelled
      const { data: workflow, error: updateError } = await supabase
        .from('agent_workflows')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', workflowId)
        .select()
        .single()

      if (updateError) throw updateError

      // Cancel any running executions for this workflow
      const { error: execError } = await supabase
        .from('agent_executions')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          error_message: 'Workflow cancelled by user'
        })
        .eq('workflow_id', workflowId)
        .eq('status', 'running')

      if (execError) throw execError

      // Update any pending/running tasks to blocked
      const { error: taskError } = await supabase
        .from('agent_tasks')
        .update({
          status: 'blocked',
          updated_at: new Date().toISOString()
        })
        .eq('workflow_id', workflowId)
        .in('status', ['pending', 'running'])

      if (taskError) throw taskError

      console.log(`[Workflows API] ✓ Workflow ${workflowId} cancelled`)

      return res.status(200).json({
        message: 'Workflow cancelled successfully',
        workflow
      })
    }

    // PATCH /api/workflows/:id - Update workflow metadata
    if (method === 'PATCH' && path.match(/^\/api\/workflows\/[^/]+$/)) {
      const workflowId = path.split('/')[3]
      const updates = req.body

      console.log(`[Workflows API] Updating workflow: ${workflowId}`)

      // Only allow updating specific fields
      const allowedFields = ['name', 'workflow_plan', 'visual_layout', 'total_steps']
      const filteredUpdates = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key]
          return obj
        }, {})

      filteredUpdates.updated_at = new Date().toISOString()

      const { data: workflow, error } = await supabase
        .from('agent_workflows')
        .update(filteredUpdates)
        .eq('id', workflowId)
        .select()
        .single()

      if (error) throw error

      console.log(`[Workflows API] ✓ Workflow ${workflowId} updated`)

      return res.status(200).json({
        message: 'Workflow updated successfully',
        workflow
      })
    }

    // POST /api/workflows/:id/duplicate - Duplicate workflow
    if (method === 'POST' && path.match(/^\/api\/workflows\/[^/]+\/duplicate$/)) {
      const workflowId = path.split('/')[3]

      console.log(`[Workflows API] Duplicating workflow: ${workflowId}`)

      // Get original workflow
      const { data: original, error: fetchError } = await supabase
        .from('agent_workflows')
        .select('*')
        .eq('id', workflowId)
        .single()

      if (fetchError || !original) {
        return res.status(404).json({ error: 'Workflow not found' })
      }

      // Create duplicate
      const duplicate = {
        name: `${original.name} (Copy)`,
        user_prompt: original.user_prompt,
        workflow_plan: original.workflow_plan,
        visual_layout: original.visual_layout,
        status: 'saved',
        total_steps: original.total_steps,
        current_step: 0,
        executive_summary: original.executive_summary
      }

      const { data: newWorkflow, error: createError } = await supabase
        .from('agent_workflows')
        .insert(duplicate)
        .select()
        .single()

      if (createError) throw createError

      // Duplicate tasks if they exist
      const { data: originalTasks } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('workflow_id', workflowId)

      if (originalTasks && originalTasks.length > 0) {
        const duplicateTasks = originalTasks.map(task => ({
          workflow_id: newWorkflow.id,
          step_order: task.step_order,
          agent_id: task.agent_id,
          title: task.title,
          description: task.description,
          status: 'pending',
          priority: task.priority,
          parameters: task.parameters
        }))

        await supabase
          .from('agent_tasks')
          .insert(duplicateTasks)
      }

      console.log(`[Workflows API] ✓ Workflow duplicated: ${newWorkflow.id}`)

      return res.status(201).json({
        message: 'Workflow duplicated successfully',
        workflow: newWorkflow
      })
    }

    // GET /api/workflows - List all workflows (with filtering)
    if (method === 'GET' && path === '/api/workflows') {
      const { status, search, limit = 50, offset = 0 } = req.query

      let query = supabase
        .from('agent_workflows')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

      // Filter by status if provided
      if (status && status !== 'all') {
        query = query.eq('status', status)
      }

      // Search by name if provided
      if (search) {
        query = query.ilike('name', `%${search}%`)
      }

      const { data: workflows, error, count } = await query

      if (error) throw error

      return res.status(200).json({
        workflows,
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      })
    }

    // GET /api/workflows/:id - Get single workflow
    if (method === 'GET' && path.match(/^\/api\/workflows\/[^/]+$/)) {
      const workflowId = path.split('/')[3]

      const { data: workflow, error } = await supabase
        .from('agent_workflows')
        .select(`
          *,
          executions:agent_executions(
            id,
            agent_id,
            status,
            started_at,
            completed_at,
            output,
            error_message,
            agent:agents(id, name, description)
          ),
          tasks:agent_tasks(
            id,
            step_order,
            title,
            description,
            status,
            priority,
            agent:agents(id, name, description)
          )
        `)
        .eq('id', workflowId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Workflow not found' })
        }
        throw error
      }

      return res.status(200).json({ workflow })
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('[Workflows API] Error:', error)
    return res.status(500).json({
      error: error.message || 'Internal server error'
    })
  }
}
