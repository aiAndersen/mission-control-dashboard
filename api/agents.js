import { supabase } from '../backend/services/supabase.js'
import { executeAgent } from '../backend/services/agentExecution.js'

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { method, url } = req
  const path = url.split('?')[0]

  try {
    // GET /api/agents - List all agents
    if (method === 'GET' && path === '/api/agents') {
      const { data: agents, error } = await supabase
        .from('agents')
        .select('*')
        .order('name')

      if (error) throw error

      return res.status(200).json({ agents })
    }

    // POST /api/agents/:id/execute - Execute specific agent
    if (method === 'POST' && path.match(/\/api\/agents\/[^/]+\/execute$/)) {
      const agentId = path.split('/')[3]
      const { parameters = {} } = req.body

      console.log(`[Agents API] Executing agent: ${agentId}`)

      // Get agent details
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single()

      if (agentError || !agent) {
        return res.status(404).json({ error: 'Agent not found' })
      }

      // Execute agent
      const execution = await executeAgent(agentId, parameters)

      return res.status(200).json({
        message: 'Agent execution started',
        execution: {
          id: execution.id,
          agentId,
          status: 'running'
        }
      })
    }

    // Method/path not found
    return res.status(404).json({ error: 'Not found' })

  } catch (error) {
    console.error('[Agents API] Error:', error)
    return res.status(500).json({
      error: error.message || 'Internal server error'
    })
  }
}
