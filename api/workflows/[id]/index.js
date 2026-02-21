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
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { id } = req.query
  const { method } = req

  try {
    // DELETE /api/workflows/:id - Delete workflow
    if (method === 'DELETE') {
      console.log(`[Workflows API] Deleting workflow: ${id}`)

      // Delete workflow (CASCADE will handle related executions, tasks, approvals)
      const { error } = await supabase
        .from('agent_workflows')
        .delete()
        .eq('id', id)

      if (error) throw error

      console.log(`[Workflows API] ✓ Workflow ${id} deleted`)

      return res.status(200).json({
        message: 'Workflow deleted successfully',
        workflowId: id
      })
    }

    // GET /api/workflows/:id - Get single workflow
    if (method === 'GET') {
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
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ error: 'Workflow not found' })
        }
        throw error
      }

      return res.status(200).json({ workflow })
    }

    // PATCH /api/workflows/:id - Update workflow
    if (method === 'PATCH') {
      const updates = req.body

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
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return res.status(200).json({
        message: 'Workflow updated successfully',
        workflow
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('[Workflows API] Error:', error)
    return res.status(500).json({
      error: error.message || 'Internal server error'
    })
  }
}
