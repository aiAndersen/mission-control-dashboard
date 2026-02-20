import { spawn } from 'child_process'
import { supabase } from './supabase.js'
import path from 'path'

/**
 * Internal agent execution service
 * Called by CEO Agent to execute worker agents
 */
export async function executeAgentInternal(agent, executionId, parameters = {}) {
  console.log(`  [Agent Execution] Starting: ${agent.name}`)

  // Merge default parameters with override parameters
  const mergedParams = { ...agent.parameters, ...parameters }

  // Convert parameters to CLI args
  const args = Object.entries(mergedParams).flatMap(([key, value]) => {
    if (value === true) return [key]  // Boolean flags
    if (value === false || value === null) return []  // Skip
    return [key, String(value)]
  })

  // Determine project path (for marketing portal agents)
  const projectPath = agent.script_path.includes('marketing-content-portal')
    ? process.env.MARKETING_PORTAL_PATH
    : path.dirname(agent.script_path)

  // Update execution status to running
  await supabase
    .from('agent_executions')
    .update({
      status: 'running',
      started_at: new Date().toISOString()
    })
    .eq('id', executionId)

  // Spawn Python process and wrap in Promise to await completion
  return new Promise((resolve, reject) => {
    const child = spawn('python3', [agent.script_path, ...args], {
      cwd: projectPath,
      env: { ...process.env }
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', async (code) => {
      const endTime = new Date()
      const startTime = new Date((await supabase.from('agent_executions').select('started_at').eq('id', executionId).single()).data.started_at)
      const duration = Math.round((endTime - startTime) / 1000)

      // Truncate output for free tier (1000 chars)
      const outputSummary = (stdout + stderr).substring(0, 1000)

      const updateData = {
        status: code === 0 ? 'completed' : 'failed',
        completed_at: endTime.toISOString(),
        duration_seconds: duration,
        output_summary: outputSummary,
        error_message: code !== 0 ? stderr.substring(0, 500) : null
      }

      // Try to extract cost from output (look for "Cost: $X.XX" pattern)
      const costMatch = stdout.match(/Cost:\s*\$?([\d.]+)/)
      if (costMatch) {
        updateData.cost_usd = parseFloat(costMatch[1])
      }

      await supabase
        .from('agent_executions')
        .update(updateData)
        .eq('id', executionId)

      console.log(`  [Agent Execution] ${code === 0 ? '✓' : '✗'} ${agent.name} finished (exit code: ${code})`)

      // Resolve or reject based on exit code
      if (code === 0) {
        resolve({
          executionId,
          success: true,
          output: outputSummary,
          duration_seconds: duration,
          cost_usd: updateData.cost_usd || 0
        })
      } else {
        reject(new Error(`Agent ${agent.name} failed with exit code ${code}: ${stderr.substring(0, 200)}`))
      }
    })

    child.on('error', async (error) => {
      await supabase
        .from('agent_executions')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message
        })
        .eq('id', executionId)

      console.error(`  [Agent Execution] ✗ ${agent.name} error: ${error.message}`)
      reject(error)
    })
  })
}
