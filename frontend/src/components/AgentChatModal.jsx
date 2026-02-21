import { useState, useEffect } from 'react'
import { Card, Title, Text, Badge, Button, Textarea, TextInput } from '@tremor/react'
import { X, Send, Sparkles, Clock, DollarSign } from 'lucide-react'
import { supabase } from '../services/supabase'

export default function AgentChatModal({ agent, onClose, onExecute }) {
  const [customPrompt, setCustomPrompt] = useState('')
  const [parameters, setParameters] = useState({})
  const [estimatedCost, setEstimatedCost] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState(0)
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (agent) {
      // Initialize with agent's default parameters
      setParameters(agent.parameters || {})
      loadTemplates()
    }
  }, [agent])

  useEffect(() => {
    calculateEstimates()
  }, [parameters, customPrompt])

  const loadTemplates = () => {
    // Predefined prompt templates per agent
    const agentTemplates = {
      'diagnose-search': [
        { name: 'Quick Diagnosis', prompt: 'Diagnose the top 3 zero-result queries and suggest fixes' },
        { name: 'Deep Analysis', prompt: 'Perform comprehensive search quality analysis with auto-fix enabled' },
        { name: 'Specific Query', prompt: 'Analyze why searches for [KEYWORD] return poor results' },
      ],
      'health-monitor': [
        { name: 'Quick Check', prompt: 'Run basic health check without AI analysis' },
        { name: 'Full Analysis', prompt: 'Run comprehensive health monitoring with anomaly detection' },
      ],
      'enrich': [
        { name: 'Batch Enrichment', prompt: 'Enrich 50 oldest records with gpt-5.2' },
        { name: 'Quick Enrichment', prompt: 'Enrich 10 records with gpt-4o-mini for speed' },
      ],
      'import-all': [
        { name: 'Full Import', prompt: 'Import from all available sources with deduplication' },
        { name: 'Webflow Only', prompt: 'Import only from Webflow sources' },
      ],
    }

    setTemplates(agentTemplates[agent.name] || [])
  }

  const calculateEstimates = () => {
    // Estimate cost based on model and parameters
    const modelCosts = {
      'gpt-4o-mini': 0.0001,
      'gpt-5-mini': 0.001,
      'gpt-5.2': 0.005,
    }

    const model = parameters['--model'] || 'gpt-5-mini'
    const limit = parseInt(parameters['--limit']) || 20
    const baseCost = modelCosts[model] || 0.001

    setEstimatedCost(baseCost * limit)
    setEstimatedTime(Math.ceil(limit * 3)) // ~3 seconds per record
  }

  const handleParameterChange = (key, value) => {
    setParameters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleTemplateSelect = (template) => {
    setCustomPrompt(template.prompt)
  }

  const handleExecute = async () => {
    if (!customPrompt.trim() && Object.keys(parameters).length === 0) {
      alert('Please enter a custom prompt or modify parameters')
      return
    }

    setLoading(true)
    try {
      // Create execution with custom prompt and parameters
      const { data, error } = await supabase
        .from('agent_executions')
        .insert({
          agent_id: agent.id,
          status: 'pending',
          triggered_by: 'custom_prompt',
          parameters_used: {
            ...parameters,
            custom_prompt: customPrompt,
          },
        })
        .select()
        .single()

      if (error) throw error

      // Execute via API
      const response = await fetch(`/api/agents/${agent.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameters: {
            ...parameters,
            '--custom-prompt': customPrompt,
          },
        }),
      })

      if (!response.ok) throw new Error('API execution failed')

      const result = await response.json()
      console.log('Custom execution started:', result)

      // Notify parent and close
      if (onExecute) {
        onExecute(agent, result.execution_id)
      }

      onClose()
    } catch (err) {
      console.error('Error executing with custom prompt:', err)
      alert(`Failed to execute: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!agent) return null

  return (
    <div className="mc-modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4">
      <Card className="mc-modal-content w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-amber-500" />
              <Title className="text-2xl">Custom Prompt</Title>
            </div>
            <Text className="text-gray-600">
              Run {agent.name} with custom instructions and parameters
            </Text>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={X}
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        {/* Templates */}
        {templates.length > 0 && (
          <div className="mb-6">
            <Text className="text-sm font-semibold mb-2">Quick Templates:</Text>
            <div className="flex flex-wrap gap-2">
              {templates.map((template, idx) => (
                <Button
                  key={idx}
                  size="xs"
                  variant="secondary"
                  onClick={() => handleTemplateSelect(template)}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Prompt Input */}
        <div className="mb-6">
          <Text className="text-sm font-semibold mb-2">Your Instructions:</Text>
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Example: Analyze search quality for 'college readiness' queries and suggest improvements with auto-fix enabled..."
            rows={6}
            className="w-full"
          />
          <Text className="text-xs text-gray-500 mt-1">
            Provide specific instructions or context for this execution
          </Text>
        </div>

        {/* Parameters */}
        <div className="mb-6">
          <Text className="text-sm font-semibold mb-3">Parameters:</Text>
          <div className="grid grid-cols-2 gap-4">
            {/* Model Selection */}
            <div>
              <Text className="text-xs mb-1">Model</Text>
              <select
                value={parameters['--model'] || 'gpt-5-mini'}
                onChange={(e) => handleParameterChange('--model', e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="gpt-4o-mini">gpt-4o-mini (fast, cheap)</option>
                <option value="gpt-5-mini">gpt-5-mini (balanced)</option>
                <option value="gpt-5.2">gpt-5.2 (advanced, expensive)</option>
              </select>
            </div>

            {/* Limit */}
            <div>
              <Text className="text-xs mb-1">Limit (records)</Text>
              <TextInput
                type="number"
                value={parameters['--limit'] || '20'}
                onChange={(e) => handleParameterChange('--limit', e.target.value)}
                placeholder="20"
              />
            </div>

            {/* Additional Flags */}
            <div className="col-span-2">
              <Text className="text-xs mb-2">Additional Options:</Text>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={parameters['--dry-run'] === 'true'}
                    onChange={(e) => handleParameterChange('--dry-run', e.target.checked ? 'true' : 'false')}
                  />
                  Dry Run (preview only)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={parameters['--verbose'] === 'true'}
                    onChange={(e) => handleParameterChange('--verbose', e.target.checked ? 'true' : 'false')}
                  />
                  Verbose Output
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={parameters['--auto-fix'] === 'true'}
                    onChange={(e) => handleParameterChange('--auto-fix', e.target.checked ? 'true' : 'false')}
                  />
                  Auto-fix (if applicable)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Estimates */}
        <div className="mb-6 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-600" />
            <div>
              <Text className="text-xs text-gray-500">Estimated Cost</Text>
              <Text className="font-semibold">${estimatedCost.toFixed(3)}</Text>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <div>
              <Text className="text-xs text-gray-500">Estimated Time</Text>
              <Text className="font-semibold">~{estimatedTime}s</Text>
            </div>
          </div>
        </div>

        {/* Execute Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Text className="text-sm text-gray-600">
            This will execute {agent.name} with your custom settings
          </Text>
          <Button
            size="lg"
            icon={Send}
            onClick={handleExecute}
            disabled={loading}
          >
            {loading ? 'Executing...' : 'Execute with Custom Prompt'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
