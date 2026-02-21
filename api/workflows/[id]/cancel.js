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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query

  try {
    console.log(`[Workflows API] Canceling workflow: ${id}`)

    // Update workflow status to cancelled
    const { data: workflow, error: updateError } = await supabase
      .from('agent_workflows')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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
      .eq('workflow_id', id)
      .eq('status', 'running')

    if (execError) throw execError

    // Update any pending/running tasks to blocked
    const { error: taskError } = await supabase
      .from('agent_tasks')
      .update({
        status: 'blocked',
        updated_at: new Date().toISOString()
      })
      .eq('workflow_id', id)
      .in('status', ['pending', 'running'])

    if (taskError) throw taskError

    console.log(`[Workflows API] ✓ Workflow ${id} cancelled`)

    return res.status(200).json({
      message: 'Workflow cancelled successfully',
      workflow
    })

  } catch (error) {
    console.error('[Workflows API] Error:', error)
    return res.status(500).json({
      error: error.message || 'Internal server error'
    })
  }
}
