import { useState, useEffect } from 'react'
import { Card, Title, Text, Badge, Button, ProgressBar, Callout } from '@tremor/react'
import { ClockIcon, CheckCircleIcon, XCircleIcon, PlayIcon, PauseIcon, SparklesIcon, Squares2X2Icon, ListBulletIcon, TrashIcon, StopIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { supabase } from '../services/supabase'
import ApprovalGate from './ApprovalGate'
import WorkflowCanvas from './workflow-editor/WorkflowCanvas'
import ExecutionLog from './ExecutionLog'
import '../styles/workflow-editor.css'

export default function WorkflowMonitor() {
  const [workflows, setWorkflows] = useState([])
  const [selectedWorkflow, setSelectedWorkflow] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingApproval, setPendingApproval] = useState(null)
  const [viewMode, setViewMode] = useState('list') // 'list' or 'canvas'
  const [viewingExecutionId, setViewingExecutionId] = useState(null)

  useEffect(() => {
    fetchWorkflows()

    // Subscribe to workflow updates
    const workflowSubscription = supabase
      .channel('workflow_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agent_workflows'
      }, () => {
        fetchWorkflows()
      })
      .subscribe()

    // Subscribe to approval requests
    const approvalSubscription = supabase
      .channel('approval_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'workflow_approvals'
      }, (payload) => {
        if (payload.new.status === 'pending') {
          setPendingApproval(payload.new)
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'workflow_approvals'
      }, (payload) => {
        if (payload.new.status !== 'pending') {
          setPendingApproval(null)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(workflowSubscription)
      supabase.removeChannel(approvalSubscription)
    }
  }, [])

  const fetchWorkflows = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('agent_workflows')
        .select(`
          *,
          executions:agent_executions(
            id,
            status,
            agent:agents(name),
            started_at,
            completed_at,
            step_order
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error

      // Sort executions by step_order
      const processedData = (data || []).map(workflow => ({
        ...workflow,
        executions: (workflow.executions || []).sort((a, b) => a.step_order - b.step_order)
      }))

      setWorkflows(processedData)
    } catch (err) {
      console.error('Error fetching workflows:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      'planning': 'gray',
      'pending_approval': 'amber',
      'saved': 'blue',
      'running': 'blue',
      'completed': 'emerald',
      'failed': 'red',
      'cancelled': 'gray'
    }
    return colors[status] || 'gray'
  }

  const getStatusIcon = (status) => {
    const icons = {
      'planning': SparklesIcon,
      'pending_approval': PauseIcon,
      'saved': ClockIcon,
      'running': PlayIcon,
      'completed': CheckCircleIcon,
      'failed': XCircleIcon,
      'cancelled': XCircleIcon
    }
    return icons[status] || ClockIcon
  }

  const handleExecuteSavedWorkflow = async (workflowId) => {
    try {
      const response = await fetch(
        `/api/ceo/workflows/${workflowId}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to execute workflow')
      }

      // Refresh workflows to show updated status
      fetchWorkflows()
    } catch (err) {
      console.error('Error executing saved workflow:', err)
      alert('Failed to execute workflow: ' + err.message)
    }
  }

  const handleCancelWorkflow = async (workflowId) => {
    if (!confirm('Are you sure you want to cancel this workflow? Running tasks will be stopped.')) {
      return
    }

    try {
      const response = await fetch(
        `/api/workflows/${workflowId}/cancel`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel workflow')
      }

      // Refresh workflows to show updated status
      fetchWorkflows()
    } catch (err) {
      console.error('Error canceling workflow:', err)
      alert('Failed to cancel workflow: ' + err.message)
    }
  }

  const handleDeleteWorkflow = async (workflowId) => {
    if (!confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(
        `/api/workflows/${workflowId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete workflow')
      }

      // Clear selected workflow if it was deleted
      if (selectedWorkflow?.id === workflowId) {
        setSelectedWorkflow(null)
      }

      // Refresh workflows
      fetchWorkflows()
    } catch (err) {
      console.error('Error deleting workflow:', err)
      alert('Failed to delete workflow: ' + err.message)
    }
  }

  const calculateProgress = (workflow) => {
    if (!workflow.executions || workflow.executions.length === 0) return 0

    const completed = workflow.executions.filter(e =>
      e.status === 'completed' || e.status === 'failed'
    ).length

    return Math.round((completed / workflow.total_steps) * 100)
  }

  const handleApprovalResponse = async (approvalId, approved, notes) => {
    try {
      const response = await fetch(
        `/api/ceo/workflows/${pendingApproval.workflow_id}/approvals/${approvalId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: approved ? 'approved' : 'rejected',
            notes,
            approved_by: 'user' // TODO: Get from auth context
          })
        }
      )

      if (!response.ok) {
        throw new Error('Failed to update approval')
      }

      setPendingApproval(null)
      fetchWorkflows() // Refresh workflows
    } catch (err) {
      console.error('Error updating approval:', err)
      alert('Failed to update approval: ' + err.message)
    }
  }

  const expandWorkflow = async (workflowId) => {
    if (selectedWorkflow?.id === workflowId) {
      setSelectedWorkflow(null)
      return
    }

    try {
      const { data, error } = await supabase
        .from('agent_workflows')
        .select(`
          *,
          executions:agent_executions(
            *,
            agent:agents(name, description, tags)
          )
        `)
        .eq('id', workflowId)
        .single()

      if (error) throw error

      // Sort executions by step_order
      data.executions = (data.executions || []).sort((a, b) => a.step_order - b.step_order)
      setSelectedWorkflow(data)
    } catch (err) {
      console.error('Error fetching workflow details:', err)
    }
  }

  // Get execution status map for canvas visualization
  const getExecutionStatus = (workflow) => {
    if (!workflow || !workflow.executions) return {}

    const statusMap = {}
    workflow.executions.forEach(execution => {
      if (execution.step_order) {
        statusMap[execution.step_order] = execution.status
      }
    })
    return statusMap
  }

  if (loading) {
    return (
      <Card>
        <Text>Loading workflows...</Text>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Pending Approval Modal */}
      {pendingApproval && (
        <ApprovalGate
          approval={pendingApproval}
          onApprove={(notes) => handleApprovalResponse(pendingApproval.id, true, notes)}
          onReject={(notes) => handleApprovalResponse(pendingApproval.id, false, notes)}
          onClose={() => setPendingApproval(null)}
        />
      )}

      {/* Execution Detail Modal */}
      {viewingExecutionId && (
        <ExecutionLog
          executionId={viewingExecutionId}
          onClose={() => setViewingExecutionId(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <Title className="text-2xl text-gray-900">Active Workflows</Title>
          <Text className="text-gray-700 text-base">Real-time orchestration by CEO Agent</Text>
        </div>
        <Button
          size="md"
          onClick={fetchWorkflows}
          color="blue"
          className="bg-[var(--mc-secondary)] text-white border-none hover:bg-[var(--mc-secondary-dark)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Refresh
        </Button>
      </div>

      {/* View Mode Toggle */}
      <div className="canvas-view-toggle mb-4">
        <button
          className={viewMode === 'list' ? 'active' : ''}
          onClick={() => setViewMode('list')}
        >
          <ListBulletIcon />
          List View
        </button>
        <button
          className={viewMode === 'canvas' ? 'active' : ''}
          onClick={() => setViewMode('canvas')}
        >
          <Squares2X2Icon />
          Canvas View
        </button>
      </div>

      {/* Workflows List or Canvas */}
      {workflows.length === 0 ? (
        <Card>
          <Text className="text-gray-700 text-base">No workflows yet. Describe a task above to get started with the CEO Agent.</Text>
        </Card>
      ) : viewMode === 'canvas' ? (
        // Canvas View - Show selected workflow or latest workflow
        <div className="space-y-4">
          {/* Workflow Selector for Canvas View */}
          <Card>
            <div className="flex items-center gap-3">
              <Text className="text-sm font-medium text-gray-700">Select Workflow:</Text>
              <select
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={selectedWorkflow?.id || workflows[0]?.id || ''}
                onChange={(e) => {
                  const workflow = workflows.find(w => w.id === e.target.value)
                  setSelectedWorkflow(workflow)
                }}
              >
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name} - {workflow.status.replace('_', ' ').toUpperCase()} ({new Date(workflow.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* Canvas Display */}
          <Card>
            <WorkflowCanvas
              workflow={selectedWorkflow || workflows[0]}
              executionStatus={getExecutionStatus(selectedWorkflow || workflows[0])}
              onNodeClick={(node) => {
                console.log('Node clicked:', node)
              }}
              readOnly={true}
            />
          </Card>

          {/* Workflow Details Below Canvas */}
          {(selectedWorkflow || workflows[0]) && (
            <Card>
              <div className="space-y-4">
                <div>
                  <Title className="text-lg text-gray-900">{(selectedWorkflow || workflows[0]).name}</Title>
                  <Text className="text-sm text-gray-600 mt-1">
                    {(selectedWorkflow || workflows[0]).user_prompt}
                  </Text>
                </div>

                {/* Executive Summary */}
                {(selectedWorkflow || workflows[0]).executive_summary && (
                  <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300">
                    <Title className="text-base mb-3 text-gray-900">Executive Summary</Title>
                    <Text className="text-base text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {(selectedWorkflow || workflows[0]).executive_summary}
                    </Text>
                  </div>
                )}

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <Badge color={getStatusColor((selectedWorkflow || workflows[0]).status)} size="lg">
                    {(selectedWorkflow || workflows[0]).status.replace('_', ' ').toUpperCase()}
                  </Badge>
                  {(selectedWorkflow || workflows[0]).status === 'running' && (
                    <>
                      <Text className="text-sm text-gray-600">
                        Step {(selectedWorkflow || workflows[0]).current_step || 0} of {(selectedWorkflow || workflows[0]).total_steps}
                      </Text>
                      <Button
                        icon={StopIcon}
                        size="sm"
                        color="red"
                        onClick={() => handleCancelWorkflow((selectedWorkflow || workflows[0]).id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {(selectedWorkflow || workflows[0]).status === 'saved' && (
                    <Button
                      icon={PlayIcon}
                      size="lg"
                      color="emerald"
                      onClick={() => handleExecuteSavedWorkflow((selectedWorkflow || workflows[0]).id)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      Execute Workflow
                    </Button>
                  )}
                  {((selectedWorkflow || workflows[0]).status === 'saved' ||
                    (selectedWorkflow || workflows[0]).status === 'completed' ||
                    (selectedWorkflow || workflows[0]).status === 'failed' ||
                    (selectedWorkflow || workflows[0]).status === 'cancelled') && (
                    <Button
                      icon={TrashIcon}
                      size="sm"
                      color="gray"
                      onClick={() => handleDeleteWorkflow((selectedWorkflow || workflows[0]).id)}
                      className="bg-gray-500 hover:bg-gray-600 text-white"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      ) : (
        // List View (Original)
        <div className="space-y-4">
          {workflows.map((workflow) => {
            const StatusIcon = getStatusIcon(workflow.status)
            const progress = calculateProgress(workflow)
            const isExpanded = selectedWorkflow?.id === workflow.id

            return (
              <Card
                key={workflow.id}
                className="cursor-pointer hover:shadow-lg hover:border-[#00A8E1] transition-all border-2 border-gray-200"
                onClick={() => expandWorkflow(workflow.id)}
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <StatusIcon className={`h-6 w-6 ${workflow.status === 'running' ? 'text-[#00A8E1]' : 'text-gray-600'}`} />
                        <Title className="text-lg text-gray-900">{workflow.name}</Title>
                        <Badge color={getStatusColor(workflow.status)} size="lg">
                          {workflow.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        {workflow.status === 'saved' && (
                          <Button
                            icon={PlayIcon}
                            size="sm"
                            color="emerald"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleExecuteSavedWorkflow(workflow.id)
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            Execute Now
                          </Button>
                        )}
                        {workflow.status === 'running' && (
                          <Button
                            icon={StopIcon}
                            size="sm"
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCancelWorkflow(workflow.id)
                            }}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Cancel
                          </Button>
                        )}
                        {(workflow.status === 'saved' ||
                          workflow.status === 'completed' ||
                          workflow.status === 'failed' ||
                          workflow.status === 'cancelled') && (
                          <Button
                            icon={TrashIcon}
                            size="sm"
                            color="gray"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteWorkflow(workflow.id)
                            }}
                            className="bg-gray-500 hover:bg-gray-600 text-white"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                      <Text className="text-base text-gray-700 line-clamp-2">
                        {workflow.user_prompt}
                      </Text>
                    </div>
                    <div className="text-right">
                      <Text className="text-sm text-gray-600">
                        {new Date(workflow.created_at).toLocaleString()}
                      </Text>
                    </div>
                  </div>

                  {/* Progress */}
                  {workflow.status === 'running' && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <Text className="text-base font-semibold text-gray-900">
                          Step {workflow.current_step || 0} of {workflow.total_steps}
                        </Text>
                        <Text className="text-lg font-bold text-[#00A8E1]">{progress}%</Text>
                      </div>
                      <ProgressBar value={progress} color="blue" className="h-3" />
                    </div>
                  )}

                  {/* Expanded Details */}
                  {isExpanded && selectedWorkflow && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                      {/* Executive Summary */}
                      {selectedWorkflow.executive_summary && (
                        <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-300">
                          <Title className="text-base mb-3 text-gray-900">Executive Summary</Title>
                          <Text className="text-base text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {selectedWorkflow.executive_summary}
                          </Text>
                        </div>
                      )}

                      {/* Execution Steps */}
                      <div>
                        <Title className="text-base mb-3 text-gray-900">Execution Steps</Title>
                        <div className="space-y-3">
                          {selectedWorkflow.executions.map((execution) => (
                            <div
                              key={execution.id}
                              className="flex items-center gap-3 p-4 bg-white rounded-lg border-2 border-gray-200 hover:border-[#00A8E1] transition-colors cursor-pointer"
                              onClick={() => setViewingExecutionId(execution.id)}
                              title="Click to view execution details and output"
                            >
                              <Badge color="blue" size="lg" className="px-3">
                                {execution.step_order}
                              </Badge>
                              <div className="flex-1">
                                <Text className="font-semibold text-gray-900 text-base">
                                  {execution.agent?.name || 'Unknown Agent'}
                                </Text>
                                {execution.started_at && (
                                  <Text className="text-sm text-gray-600">
                                    Started: {new Date(execution.started_at).toLocaleTimeString()}
                                  </Text>
                                )}
                                {execution.error_message && (
                                  <Text className="text-xs text-red-600 mt-0.5 line-clamp-1">
                                    {execution.error_message}
                                  </Text>
                                )}
                              </div>
                              <Badge color={getStatusColor(execution.status)} size="lg">
                                {execution.status.toUpperCase()}
                              </Badge>
                              {execution.duration_seconds && (
                                <Text className="text-sm text-gray-700 font-medium">
                                  {execution.duration_seconds}s
                                </Text>
                              )}
                              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 flex-shrink-0" title="View logs" />
                            </div>
                          ))}
                        </div>
                        <Text className="text-xs text-gray-500 mt-2">Click any step to view execution output and logs</Text>
                      </div>

                      {/* Workflow Plan */}
                      {selectedWorkflow.workflow_plan && (
                        <details className="cursor-pointer">
                          <summary className="text-sm font-medium text-gray-700 hover:text-gray-900">
                            View Full Plan
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
                            {JSON.stringify(selectedWorkflow.workflow_plan, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
