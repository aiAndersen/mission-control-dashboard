import { useState, useEffect, useRef } from 'react'
import { Card, Title, Text, Badge, Button } from '@tremor/react'
import { X, RefreshCw, Download } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '../services/supabase'

export default function ExecutionLog({ executionId, onClose }) {
  const [execution, setExecution] = useState(null)
  const [loading, setLoading] = useState(true)
  const logRef = useRef(null)

  useEffect(() => {
    if (!executionId) return

    fetchExecution()

    // Subscribe to real-time updates for this execution
    const subscription = supabase
      .channel(`execution_${executionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_executions',
          filter: `id=eq.${executionId}`
        },
        (payload) => {
          console.log('Execution updated:', payload)
          setExecution(payload.new)
          scrollToBottom()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [executionId])

  const fetchExecution = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('agent_executions')
        .select(`
          *,
          agent:agents(name, description, script_path, project:projects(name))
        `)
        .eq('id', executionId)
        .single()

      if (error) throw error
      setExecution(data)
      scrollToBottom()
    } catch (err) {
      console.error('Error fetching execution:', err)
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight
      }
    }, 100)
  }

  const downloadLog = () => {
    if (!execution?.output_summary) return

    const blob = new Blob([execution.output_summary], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `execution-${executionId}.log`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-3/4 h-3/4">
          <Text>Loading execution...</Text>
        </Card>
      </div>
    )
  }

  if (!execution) {
    return null
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

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <div className="mc-modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4">
      <Card className="mc-modal-content w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Title>{execution.agent?.name || 'Execution'}</Title>
              <Badge color={getStatusColor(execution.status)} size="lg">
                {execution.status}
              </Badge>
            </div>
            <Text className="text-sm text-gray-600">
              {execution.agent?.description}
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              {execution.agent?.project?.name} / {execution.agent?.script_path}
            </Text>
          </div>

          <div className="flex gap-2">
            <Button
              size="xs"
              variant="secondary"
              icon={RefreshCw}
              onClick={fetchExecution}
            >
              Refresh
            </Button>
            <Button
              size="xs"
              variant="secondary"
              icon={Download}
              onClick={downloadLog}
              disabled={!execution.output_summary}
            >
              Download
            </Button>
            <Button
              size="xs"
              variant="secondary"
              icon={X}
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div>
            <Text className="text-xs text-gray-500">Triggered By</Text>
            <Text className="font-semibold">{execution.triggered_by}</Text>
          </div>
          <div>
            <Text className="text-xs text-gray-500">Started</Text>
            <Text className="font-semibold">
              {execution.started_at
                ? formatDistanceToNow(new Date(execution.started_at), { addSuffix: true })
                : 'Not started'}
            </Text>
          </div>
          <div>
            <Text className="text-xs text-gray-500">Duration</Text>
            <Text className="font-semibold">
              {formatDuration(execution.duration_seconds)}
            </Text>
          </div>
          <div>
            <Text className="text-xs text-gray-500">Cost</Text>
            <Text className="font-semibold text-green-600">
              ${parseFloat(execution.cost_usd || 0).toFixed(3)}
            </Text>
          </div>
          <div>
            <Text className="text-xs text-gray-500">Created</Text>
            <Text className="font-semibold">
              {formatDistanceToNow(new Date(execution.created_at), { addSuffix: true })}
            </Text>
          </div>
        </div>

        {/* Error Message */}
        {execution.error_message && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            <Text className="text-sm text-red-800 font-semibold">Error:</Text>
            <Text className="text-sm text-red-700">{execution.error_message}</Text>
          </div>
        )}

        {/* Parameters */}
        {execution.parameters_used && Object.keys(execution.parameters_used).length > 0 && (
          <div className="mb-4">
            <Text className="text-sm font-semibold mb-2">Parameters:</Text>
            <div className="flex flex-wrap gap-2">
              {Object.entries(execution.parameters_used).map(([key, value]) => (
                <Badge key={key} color="gray" size="sm">
                  {key}: {String(value)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Log Output */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Text className="text-sm font-semibold mb-2">Output:</Text>
          <div
            ref={logRef}
            className="mc-terminal flex-1 overflow-auto"
          >
            {execution.output_summary ? (
              <pre className="whitespace-pre-wrap">{execution.output_summary}</pre>
            ) : (
              <Text className="text-gray-500">No output yet...</Text>
            )}

            {execution.status === 'running' && (
              <div className="mt-2 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <Text className="text-green-400">Execution in progress...</Text>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
