import { supabase } from '../backend/services/supabase.js'

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { method, url } = req
  const path = url.split('?')[0]

  try {
    // POST /api/execution-control/pause/:id
    if (method === 'POST' && path.match(/\/api\/execution-control\/pause\/[^/]+$/)) {
      const executionId = path.split('/').pop()

      const { error } = await supabase
        .from('agent_executions')
        .update({ status: 'paused', paused_at: new Date().toISOString() })
        .eq('id', executionId)

      if (error) throw error

      return res.status(200).json({ message: 'Execution paused', executionId })
    }

    // POST /api/execution-control/resume/:id
    if (method === 'POST' && path.match(/\/api\/execution-control\/resume\/[^/]+$/)) {
      const executionId = path.split('/').pop()

      const { error } = await supabase
        .from('agent_executions')
        .update({ status: 'running', resumed_at: new Date().toISOString() })
        .eq('id', executionId)

      if (error) throw error

      return res.status(200).json({ message: 'Execution resumed', executionId })
    }

    // POST /api/execution-control/cancel/:id
    if (method === 'POST' && path.match(/\/api\/execution-control\/cancel\/[^/]+$/)) {
      const executionId = path.split('/').pop()

      const { error } = await supabase
        .from('agent_executions')
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', executionId)

      if (error) throw error

      return res.status(200).json({ message: 'Execution cancelled', executionId })
    }

    return res.status(404).json({ error: 'Not found' })

  } catch (error) {
    console.error('[Execution Control API] Error:', error)
    return res.status(500).json({
      error: error.message || 'Internal server error'
    })
  }
}
