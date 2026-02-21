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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
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

  } catch (error) {
    console.error('[Workflows API] Error:', error)
    return res.status(500).json({
      error: error.message || 'Internal server error'
    })
  }
}
