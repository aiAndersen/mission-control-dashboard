import { useState, useEffect } from 'react'
import { Card, Title, Text, Badge, Button, Metric, ProgressBar } from '@tremor/react'
import { X, Play, StopCircle, RefreshCw, MessageSquare, Clock, Zap, AlertCircle, CheckCircle, Code } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '../services/supabase'

export default function AgentDetailModal({ agent, onClose, onExecute, onOpenChat }) {
  const [executions, setExecutions] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stopping, setStopping] = useState(new Set())
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    if (agent) {
      fetchAgentData()
    }
  }, [agent])

  const fetchAgentData = async () => {
    setLoading(true)
    try {
      // Fetch recent executions
      const { data: execs, error: execError } = await supabase
        .from('agent_executions')
        .select('*')
        .eq('agent_id', agent.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (execError) throw execError

      setExecutions(execs || [])

      // Calculate stats
      const completed = execs.filter(e => e.status === 'completed').length
      const failed = execs.filter(e => e.status === 'failed').length
      const avgDuration = execs
        .filter(e => e.duration_seconds)
        .reduce((sum, e) => sum + e.duration_seconds, 0) / (execs.length || 1)
      const totalCost = execs
        .reduce((sum, e) => sum + parseFloat(e.cost_usd || 0), 0)

      setStats({
        total: execs.length,
        completed,
        failed,
        running: execs.filter(e => e.status === 'running').length,
        successRate: execs.length ? Math.round((completed / execs.length) * 100) : 0,
        avgDuration: Math.round(avgDuration),
        totalCost,
      })
    } catch (err) {
      console.error('Error fetching agent data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStop = async (executionId) => {
    setStopping(prev => new Set(prev).add(executionId))
    try {
      const response = await fetch(`/api/execution-control/${executionId}/stop`, {
        method: 'POST',
      })

      if (!response.ok) throw new Error('Failed to stop execution')

      const result = await response.json()
      console.log('Execution stopped:', result)

      // Refresh data
      fetchAgentData()
    } catch (err) {
      console.error('Error stopping execution:', err)
      alert(`Failed to stop execution: ${err.message}`)
    } finally {
      setStopping(prev => {
        const next = new Set(prev)
        next.delete(executionId)
        return next
      })
    }
  }

  const getStatusIcon = (status) => {
    const icons = {
      pending: Clock,
      running: Zap,
      completed: CheckCircle,
      failed: AlertCircle,
    }
    const Icon = icons[status] || Clock
    return <Icon className="w-4 h-4" />
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: 'blue',
      running: 'amber',
      completed: 'emerald',
      failed: 'red',
    }
    return colors[status] || 'gray'
  }

  if (!agent) return null

  return (
    <div className="mc-modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4">
      <Card className="mc-modal-content w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <Title className="text-3xl">{agent.name}</Title>
              <div className="flex gap-2">
                {(agent.tags || []).map(tag => (
                  <Badge key={tag} color="blue" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <Text className="text-gray-600 mb-2">{agent.description}</Text>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Code className="w-4 h-4" />
                <Text>{agent.script_path}</Text>
              </div>
              <Text>•</Text>
              <Text>Project: {agent.project?.name || 'Unknown'}</Text>
              <Text>•</Text>
              <Text>Language: {agent.language}</Text>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              icon={MessageSquare}
              onClick={() => onOpenChat(agent)}
            >
              Custom Prompt
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={Play}
              onClick={() => onExecute(agent)}
            >
              Run Now
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={X}
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {['overview', 'runs', 'parameters'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
                activeTab === tab
                  ? 'bg-[var(--mc-secondary)] text-white border-[var(--mc-secondary-dark)]'
                  : 'bg-white text-gray-700'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <Card decoration="top" decorationColor="blue">
              <Text className="text-sm">Total Executions</Text>
              <Metric>{stats.total}</Metric>
            </Card>
            <Card decoration="top" decorationColor="emerald">
              <Text className="text-sm">Success Rate</Text>
              <Metric>{stats.successRate}%</Metric>
            </Card>
            <Card decoration="top" decorationColor="amber">
              <Text className="text-sm">Currently Running</Text>
              <Metric>{stats.running}</Metric>
            </Card>
            <Card decoration="top" decorationColor="indigo">
              <Text className="text-sm">Avg Duration</Text>
              <Metric>{stats.avgDuration}s</Metric>
            </Card>
            <Card decoration="top" decorationColor="rose">
              <Text className="text-sm">Total Cost</Text>
              <Metric>${stats.totalCost.toFixed(2)}</Metric>
            </Card>
          </div>
        )}

        {/* Default Parameters */}
        {activeTab === 'parameters' && agent.parameters && Object.keys(agent.parameters).length > 0 && (
          <div className="mb-6">
            <Title className="text-lg mb-3">Default Parameters</Title>
            <div className="flex flex-wrap gap-2">
              {Object.entries(agent.parameters).map(([key, value]) => (
                <Badge key={key} color="gray" size="lg">
                  {key}: {String(value)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Purpose & Capabilities */}
        {activeTab === 'overview' && (
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div>
              <Title className="text-lg mb-3">Purpose</Title>
              <Text className="text-gray-700">
                {agent.description || 'Multi-step agent for automated tasks'}
              </Text>
            </div>
            <div>
              <Title className="text-lg mb-3">Schedule</Title>
              <Text className="text-gray-700">
                {agent.default_schedule || 'On-demand only'}
              </Text>
            </div>
          </div>
        )}

        {/* Recent Executions */}
        {activeTab === 'runs' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <Title className="text-lg">Recent Executions</Title>
            <Button
              size="xs"
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchAgentData}
            >
              Refresh
            </Button>
          </div>

          {loading ? (
            <Text>Loading executions...</Text>
          ) : executions.length === 0 ? (
            <Card>
              <Text className="text-gray-500">No executions yet. Click "Run Now" to start.</Text>
            </Card>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {executions.map(exec => (
                <Card key={exec.id} className="hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className={`mc-status-dot ${exec.status}`}></span>
                      {getStatusIcon(exec.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge color={getStatusColor(exec.status)} size="xs">
                            {exec.status}
                          </Badge>
                          <Text className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(exec.created_at), { addSuffix: true })}
                          </Text>
                        </div>

                        {exec.status === 'running' && exec.started_at && (
                          <ProgressBar
                            value={Math.min(90, ((Date.now() - new Date(exec.started_at)) / 60000) * 90)}
                            color="amber"
                            className="mt-1"
                          />
                        )}

                        <div className="flex items-center gap-3 mt-1">
                          <Text className="text-xs">
                            Triggered: {exec.triggered_by}
                          </Text>
                          {exec.duration_seconds && (
                            <Text className="text-xs">
                              Duration: {exec.duration_seconds}s
                            </Text>
                          )}
                          {exec.cost_usd > 0 && (
                            <Text className="text-xs font-semibold text-green-600">
                              ${parseFloat(exec.cost_usd).toFixed(3)}
                            </Text>
                          )}
                        </div>

                        {exec.error_message && (
                          <Text className="text-xs text-red-600 mt-1">
                            {exec.error_message}
                          </Text>
                        )}
                      </div>
                    </div>

                    {exec.status === 'running' && (
                      <Button
                        size="xs"
                        color="red"
                        icon={StopCircle}
                        onClick={() => handleStop(exec.id)}
                        disabled={stopping.has(exec.id)}
                      >
                        {stopping.has(exec.id) ? 'Stopping...' : 'Stop'}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        )}
      </Card>
    </div>
  )
}
