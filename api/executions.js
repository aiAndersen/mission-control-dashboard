import { supabase } from '../backend/services/supabase.js'

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { method, query } = req

  try {
    // GET /api/executions - Get execution history
    if (method === 'GET') {
      const { agent_id, workflow_id, limit = 50 } = query

      let queryBuilder = supabase
        .from('agent_executions')
        .select(`
          *,
          agent:agents(id, name, description, tags)
        `)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit))

      if (agent_id) {
        queryBuilder = queryBuilder.eq('agent_id', agent_id)
      }

      if (workflow_id) {
        queryBuilder = queryBuilder.eq('workflow_id', workflow_id)
      }

      const { data: executions, error } = await queryBuilder

      if (error) throw error

      return res.status(200).json({ executions })
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('[Executions API] Error:', error)
    return res.status(500).json({
      error: error.message || 'Internal server error'
    })
  }
}
