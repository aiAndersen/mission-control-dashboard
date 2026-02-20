import express from 'express'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// GET /api/executions - List recent executions
router.get('/', async (req, res) => {
  try {
    const { limit = 50, agent_id } = req.query

    let query = supabase
      .from('agent_executions')
      .select(`
        *,
        agent:agents(name, description, project:projects(name))
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    if (agent_id) {
      query = query.eq('agent_id', agent_id)
    }

    const { data, error } = await query

    if (error) throw error
    res.json({ executions: data || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/executions/:id - Get single execution
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agent_executions')
      .select(`
        *,
        agent:agents(name, description, script_path, project:projects(*))
      `)
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Execution not found' })

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
