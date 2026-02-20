import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'
import dotenv from 'dotenv'

dotenv.config()

const router = express.Router()

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Track running processes
const runningProcesses = new Map()

// POST /api/execution-control/:id/stop - Stop a running execution
router.post('/:id/stop', async (req, res) => {
  try {
    const { id } = req.params

    // Get execution details
    const { data: execution, error } = await supabase
      .from('agent_executions')
      .select('*, agent:agents(name, script_path)')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!execution) return res.status(404).json({ error: 'Execution not found' })

    if (execution.status !== 'running' && execution.status !== 'pending') {
      return res.status(400).json({ error: 'Execution is not running' })
    }

    // Try to kill the process
    const processInfo = runningProcesses.get(id)
    if (processInfo) {
      try {
        process.kill(processInfo.pid, 'SIGTERM')
        runningProcesses.delete(id)
      } catch (err) {
        console.error('Error killing process:', err)
      }
    }

    // Update execution status
    await supabase
      .from('agent_executions')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: 'Manually stopped by user',
      })
      .eq('id', id)

    res.json({
      success: true,
      message: 'Execution stopped',
      execution_id: id,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/execution-control/:id/restart - Restart a failed execution
router.post('/:id/restart', async (req, res) => {
  try {
    const { id } = req.params

    // Get original execution
    const { data: original, error } = await supabase
      .from('agent_executions')
      .select('*, agent:agents(*)')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!original) return res.status(404).json({ error: 'Execution not found' })

    // Create new execution with same parameters
    const { data: newExecution, error: createError } = await supabase
      .from('agent_executions')
      .insert({
        agent_id: original.agent_id,
        status: 'pending',
        triggered_by: 'restart',
        parameters_used: original.parameters_used,
      })
      .select()
      .single()

    if (createError) throw createError

    res.json({
      success: true,
      message: 'Execution restarted',
      original_id: id,
      new_execution_id: newExecution.id,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Helper to register a running process
export function registerProcess(executionId, pid) {
  runningProcesses.set(executionId, { pid, startedAt: Date.now() })
}

export default router
