import OpenAI from 'openai'
import { supabase } from './supabase.js'
import fs from 'fs/promises'
import path from 'path'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY?.replace(/\s/g, '') })

// Model routing strategy (intelligent selection per task type)
const selectModel = (taskType) => {
  if (taskType === 'strategic_planning' || taskType === 'executive_summary' || taskType === 'agent_creation') {
    return 'gpt-5.2'  // Strategic thinking, code generation
  } else if (taskType === 'coordination' || taskType === 'result_analysis') {
    return 'gpt-5-mini'  // Standard coordination
  } else {
    return 'gpt-4o-mini'  // Quick status checks
  }
}

class CEOAgent {
  /**
   * Plan a multi-step workflow from natural language user prompt
   * Uses GPT-5.2 for strategic planning and capability gap analysis
   */
  async planWorkflow(userPrompt, availableAgents) {
    const model = selectModel('strategic_planning')  // gpt-5.2

    const systemPrompt = `You are a CEO Agent orchestrating specialized AI worker agents.

Available worker agents:
${availableAgents.map(a => `- ${a.name}: ${a.description || 'No description'}`).join('\n')}

Given a high-level task:
1. Plan a workflow using existing agents when possible
2. If capabilities are missing, identify new agents needed
3. Include agent creation steps in the workflow plan
4. Estimate costs and duration

Respond with JSON only:
{
  "workflow_name": "brief-name",
  "reasoning": "Why this approach makes sense",
  "new_agents_needed": [
    {
      "name": "agent-name",
      "description": "What it does",
      "capabilities": ["capability1", "capability2"]
    }
  ],
  "steps": [
    {
      "step_number": 1,
      "agent": "agent-name",
      "description": "What this step does",
      "parameters": {"--limit": 20, "--model": "gpt-5-mini"},
      "requires_approval": false,
      "gate_condition": "none|pre_check|post_validation"
    }
  ],
  "estimated_cost": 0.85,
  "estimated_duration_minutes": 15
}`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Create a workflow plan for: ${userPrompt}` }
    ]

    const apiParams = {
      model,
      messages,
      max_completion_tokens: 3000  // GPT-5.x uses max_completion_tokens
    }

    console.log(`  [CEO Agent] Planning workflow with ${model}...`)
    const response = await openai.chat.completions.create(apiParams)
    const content = response.choices[0].message.content

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from GPT-5.2 response')
    }

    const plan = JSON.parse(jsonMatch[1] || jsonMatch[0])

    console.log(`  [CEO Agent] ✓ Plan created: ${plan.workflow_name} (${plan.steps.length} steps)`)

    return plan
  }

  /**
   * Create a new worker agent (self-replication)
   * Uses GPT-5.2 to generate complete Python script
   */
  async createWorkerAgent(agentSpec, workflowId) {
    console.log(`  [CEO Agent] Creating new worker agent: ${agentSpec.name}...`)

    // Safety checks
    if (agentSpec.capabilities?.includes('self-replication')) {
      throw new Error('Recursive agent creation not allowed')
    }

    const destructiveCapabilities = ['delete', 'drop', 'destroy', 'truncate']
    if (agentSpec.capabilities?.some(c => destructiveCapabilities.includes(c.toLowerCase()))) {
      throw new Error('Destructive capabilities not allowed')
    }

    const model = selectModel('agent_creation')  // gpt-5.2

    const systemPrompt = `You are a senior Python developer creating AI agent scripts.

Generate a complete Python script for a new worker agent with these capabilities:
${agentSpec.capabilities?.join(', ') || 'data analysis'}

The script MUST follow these patterns:
1. argparse for CLI arguments (--limit, --dry-run, --verbose, --model)
2. dotenv for environment variables (DATABASE_URL, OPENAI_API_KEY)
3. psycopg2 + RealDictCursor for database access
4. OpenAI API integration with proper model handling:
   - For gpt-5.x: Use max_completion_tokens, NO temperature parameter
   - For gpt-4o-mini: Use max_tokens and temperature
5. Multi-step execution with progress reporting
6. Error handling (record errors, no retries)
7. JSON output for structured results
8. Cost tracking

Security requirements:
- NO os.system() or subprocess with shell=True
- NO destructive database operations (DELETE, DROP, TRUNCATE)
- Read-only database operations unless explicitly needed
- Sandbox all file operations to /tmp/

Generate ONLY the Python code, no explanations.`

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate agent: ${agentSpec.name}\n\nDescription: ${agentSpec.description}\n\nCapabilities: ${agentSpec.capabilities?.join(', ') || 'analysis'}` }
      ],
      max_completion_tokens: 4000
    })

    const scriptContent = this.extractCodeFromResponse(response.choices[0].message.content)

    // Validate code safety
    if (!this.validateCodeSafety(scriptContent)) {
      throw new Error('Generated code failed safety validation')
    }

    // Store in database for audit
    const { data: codeGen, error: codeGenError } = await supabase
      .from('agent_code_generations')
      .insert({
        agent_name: agentSpec.name,
        description: agentSpec.description,
        capabilities: agentSpec.capabilities,
        generated_code: scriptContent,
        validation_status: 'safe',
        created_by: 'ceo-agent'
      })
      .select()
      .single()

    if (codeGenError) throw codeGenError

    // Create approval gate for agent creation
    const { data: approval, error: approvalError } = await supabase
      .from('workflow_approvals')
      .insert({
        workflow_id: workflowId,
        step_order: 0,
        approval_type: 'agent_creation',
        prompt: `Approve creation of new agent: ${agentSpec.name}?\n\nDescription: ${agentSpec.description}\n\nCapabilities: ${agentSpec.capabilities?.join(', ')}\n\nGenerated ${scriptContent.split('\n').length} lines of Python code.`,
        context: {
          agent_name: agentSpec.name,
          code_preview: scriptContent.substring(0, 500),
          code_generation_id: codeGen.id,
          capabilities: agentSpec.capabilities
        },
        status: 'pending'
      })
      .select()
      .single()

    if (approvalError) throw approvalError

    console.log(`  [CEO Agent] ⏸ Agent creation requires approval (approval_id: ${approval.id})`)

    return {
      requiresApproval: true,
      approvalId: approval.id,
      codeGenerationId: codeGen.id,
      scriptContent
    }
  }

  /**
   * Finalize agent creation after approval
   * Writes script to file and registers in database
   */
  async finalizeAgentCreation(codeGenerationId, approvalId) {
    // Get code generation record
    const { data: codeGen, error: codeGenError } = await supabase
      .from('agent_code_generations')
      .select('*')
      .eq('id', codeGenerationId)
      .single()

    if (codeGenError) throw codeGenError

    // Write script to file
    const scriptPath = `/Users/andrewandersen/Desktop/mission-control-dashboard/scripts/${codeGen.agent_name}.py`
    await fs.writeFile(scriptPath, codeGen.generated_code, { mode: 0o755 })

    // Register agent in database
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert({
        name: codeGen.agent_name,
        description: codeGen.description,
        script_path: scriptPath,
        language: 'python',
        parameters: {},
        tags: ['ai-generated', 'ceo-created', ...(codeGen.capabilities || [])],
        project_id: null  // CEO-created agents are cross-project
      })
      .select()
      .single()

    if (agentError) throw agentError

    console.log(`  [CEO Agent] ✓ Created new worker agent: ${codeGen.agent_name} (agent_id: ${agent.id})`)

    return agent
  }

  /**
   * Execute a planned workflow step-by-step
   * Monitors child executions and implements approval gates
   */
  async executeWorkflow(workflowId, plan) {
    console.log(`\n  [CEO Agent] Starting workflow: ${plan.workflow_name}`)

    const results = []

    try {
      // Update workflow status to running
      await supabase
        .from('agent_workflows')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
          current_step: 0
        })
        .eq('id', workflowId)

      // Create new agents if needed
      if (plan.new_agents_needed?.length > 0) {
        console.log(`  [CEO Agent] Creating ${plan.new_agents_needed.length} new agent(s)...`)

        for (const agentSpec of plan.new_agents_needed) {
          const creation = await this.createWorkerAgent(agentSpec, workflowId)

          // Wait for approval
          const approved = await this.waitForApproval(workflowId, creation.approvalId)

          if (!approved) {
            throw new Error(`Agent creation rejected: ${agentSpec.name}`)
          }

          // Finalize creation
          await this.finalizeAgentCreation(creation.codeGenerationId, creation.approvalId)
        }
      }

      // Execute each step
      for (let i = 0; i < plan.steps.length; i++) {
        const step = plan.steps[i]

        console.log(`\n  [CEO Agent] Step ${i + 1}/${plan.steps.length}: ${step.agent}`)
        console.log(`    Description: ${step.description}`)

        // Update current step
        await supabase
          .from('agent_workflows')
          .update({ current_step: i + 1 })
          .eq('id', workflowId)

        // Check if approval required
        if (this.requiresApproval(step)) {
          const approvalId = await this.createApprovalGate(workflowId, i, step)
          const approved = await this.waitForApproval(workflowId, approvalId)

          if (!approved) {
            console.log(`    ✗ Step rejected by user`)
            await supabase
              .from('agent_workflows')
              .update({ status: 'cancelled' })
              .eq('id', workflowId)
            return results
          }
        }

        // Update task status to 'running' before execution
        await supabase
          .from('agent_tasks')
          .update({
            status: 'running',
            started_at: new Date().toISOString()
          })
          .match({ workflow_id: workflowId, step_order: i + 1 })

        // Execute step (executeAgent now waits for completion)
        const result = await this.executeAgent(step.agent, step.parameters, workflowId, i + 1)

        results.push(result)

        // Link task to execution and update final status
        await supabase
          .from('agent_tasks')
          .update({
            execution_id: result.id,
            status: result.status, // 'completed' or 'failed'
            completed_at: result.status === 'completed' || result.status === 'failed'
              ? new Date().toISOString()
              : null
          })
          .match({ workflow_id: workflowId, step_order: i + 1 })

        console.log(`    ${result.status === 'completed' ? '✓' : '✗'} ${result.status} (${result.duration_seconds}s, $${result.cost_usd})`)

        // Update workflow with completed step count for real-time UI updates
        await supabase
          .from('agent_workflows')
          .update({
            current_step: i + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', workflowId)

        // Gate logic: stop if pre-check fails
        if (step.gate_condition === 'pre_check' && result.status === 'failed') {
          console.log(`    ⏸ Pre-check failed, aborting workflow`)
          break
        }
      }

      // Generate executive summary
      console.log(`\n  [CEO Agent] Generating executive summary...`)
      const summary = await this.generateExecutiveSummary(workflowId, plan, results)

      // Update workflow as completed
      const totalCost = results.reduce((sum, r) => sum + parseFloat(r.cost_usd || 0), 0)
      await supabase
        .from('agent_workflows')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_cost_usd: totalCost,
          results,
          executive_summary: summary
        })
        .eq('id', workflowId)

      console.log(`  [CEO Agent] ✓ Workflow completed! Total cost: $${totalCost.toFixed(3)}`)

      return results

    } catch (error) {
      console.error(`  [CEO Agent] ✗ Workflow failed: ${error.message}`)

      await supabase
        .from('agent_workflows')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          results
        })
        .eq('id', workflowId)

      throw error
    }
  }

  /**
   * Check if a step requires human approval
   * Only critical/destructive actions require approval
   */
  requiresApproval(step) {
    const criticalAgents = ['import-all', 'enrich', 'deploy-check']
    const criticalFlags = ['--auto-fix', '--force', '--no-dry-run']

    return (
      criticalAgents.some(agent => step.agent.includes(agent)) ||
      Object.keys(step.parameters || {}).some(param => criticalFlags.includes(param))
    )
  }

  /**
   * Create an approval gate and return approval ID
   */
  async createApprovalGate(workflowId, stepOrder, step) {
    const { data, error } = await supabase
      .from('workflow_approvals')
      .insert({
        workflow_id: workflowId,
        step_order: stepOrder,
        approval_type: 'critical_action',
        prompt: `Approve execution of: ${step.agent}?\n\nDescription: ${step.description}\n\nParameters: ${JSON.stringify(step.parameters, null, 2)}`,
        context: step,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    console.log(`    ⏸ Approval required (approval_id: ${data.id})`)

    return data.id
  }

  /**
   * Wait for human approval (polls every 2 seconds)
   */
  async waitForApproval(workflowId, approvalId) {
    console.log(`    ⏸ Waiting for approval...`)

    while (true) {
      const { data, error } = await supabase
        .from('workflow_approvals')
        .select('*')
        .eq('id', approvalId)
        .single()

      if (error) throw error

      if (data.status === 'approved') {
        console.log(`    ✓ Approved by ${data.approved_by || 'user'}`)
        return true
      }

      if (data.status === 'rejected') {
        console.log(`    ✗ Rejected by ${data.approved_by || 'user'}`)
        return false
      }

      // Poll every 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  /**
   * Execute a worker agent via internal API
   */
  async executeAgent(agentName, parameters, workflowId, stepOrder) {
    // Get agent from database
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('name', agentName)
      .single()

    if (agentError) throw new Error(`Agent not found: ${agentName}`)

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from('agent_executions')
      .insert({
        agent_id: agent.id,
        workflow_id: workflowId,
        step_order: stepOrder,
        status: 'pending',
        triggered_by: 'ceo-agent',
        parameters_used: parameters
      })
      .select()
      .single()

    if (execError) throw execError

    // Trigger agent execution (same as existing agent execution logic)
    // Import agent execution service and call it
    const { executeAgentInternal } = await import('./agentExecution.js')
    await executeAgentInternal(agent, execution.id, parameters)

    // Fetch final execution record after completion
    const { data: finalExecution, error: fetchError } = await supabase
      .from('agent_executions')
      .select('*')
      .eq('id', execution.id)
      .single()

    if (fetchError) throw fetchError

    return finalExecution
  }

  /**
   * Create agent_tasks records from workflow plan for Kanban board integration
   */
  async createTasksFromWorkflow(workflowId, plan) {
    console.log(`  [CEO Agent] Creating ${plan.steps.length} tasks for Kanban board...`)

    // Prepare task records
    const tasks = []

    for (const step of plan.steps) {
      // Look up agent_id by agent name
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id')
        .eq('name', step.agent)
        .single()

      if (agentError) {
        console.error(`    ✗ Could not find agent: ${step.agent}`)
        continue
      }

      tasks.push({
        workflow_id: workflowId,
        step_order: step.step_number,
        agent_id: agent.id,
        title: `Step ${step.step_number}: ${step.agent}`,
        description: step.description,
        status: 'pending',
        priority: step.requires_approval ? 'high' : 'medium',
        parameters: step.parameters || {}
      })
    }

    // Insert all tasks at once
    const { error } = await supabase
      .from('agent_tasks')
      .insert(tasks)

    if (error) {
      console.error(`    ✗ Failed to create tasks: ${error.message}`)
      throw error
    }

    console.log(`    ✓ Created ${tasks.length} tasks`)
  }


  /**
   * Generate executive summary using GPT-5.2
   */
  async generateExecutiveSummary(workflowId, plan, results) {
    const model = selectModel('executive_summary')  // gpt-5.2

    const summaryPrompt = `Workflow: ${plan.workflow_name}

Reasoning: ${plan.reasoning}

Steps executed:
${results.map((r, i) => `${i + 1}. ${r.agent?.name || 'Unknown'}: ${r.status} (${r.duration_seconds}s, $${r.cost_usd})`).join('\n')}

Results summary:
${results.map((r, i) => `Step ${i + 1}: ${r.output_summary?.substring(0, 200) || 'No output'}`).join('\n\n')}

Generate an executive summary in markdown with:
## Key Findings
- 3-5 bullet points

## Actions Taken
- What was executed

## Metrics/Impact
- Duration, cost, success rate

## Recommendations
- Strategic next steps (if applicable)

Be concise and strategic. Focus on business value.`

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a CEO summarizing team execution results.' },
        { role: 'user', content: summaryPrompt }
      ],
      max_completion_tokens: 1500
    })

    return response.choices[0].message.content
  }

  /**
   * Extract Python code from GPT response (handles markdown)
   */
  extractCodeFromResponse(content) {
    const codeMatch = content.match(/```python\n([\s\S]*?)\n```/)
    return codeMatch ? codeMatch[1] : content
  }

  /**
   * Validate generated code for safety
   */
  validateCodeSafety(code) {
    const dangerousPatterns = [
      /os\.system/,
      /subprocess\./,
      /eval\(/,
      /exec\(/,
      /__import__\(/,
      /DROP TABLE/i,
      /DELETE FROM/i,
      /TRUNCATE/i,
      /shell=True/
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        console.log(`    ⚠ Dangerous pattern detected: ${pattern}`)
        return false
      }
    }

    return true
  }
}

export default new CEOAgent()
