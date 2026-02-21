import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { Card, Badge, ProgressBar, Text, Button } from '@tremor/react'
import { Clock, Zap, CheckCircle, XCircle, AlertCircle, StopCircle, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '../services/supabase'

const STAGES = [
  { id: 'backlog', label: 'Backlog', color: 'gray' },
  { id: 'queued', label: 'Queued', color: 'blue' },
  { id: 'in_progress', label: 'In Progress', color: 'amber' },
  { id: 'completed', label: 'Completed', color: 'emerald' },
  { id: 'blocked', label: 'Failed', color: 'red' },
]

const getStatusIcon = (status) => {
  const icons = {
    pending: Clock,
    running: Zap,
    completed: CheckCircle,
    failed: XCircle,
    blocked: AlertCircle,
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
    blocked: 'rose',
  }
  return colors[status] || 'gray'
}

// Map execution status to Kanban stage
const mapStatusToStage = (status) => {
  const mapping = {
    pending: 'queued',
    running: 'in_progress',
    completed: 'completed',
    failed: 'blocked',
  }
  return mapping[status] || 'backlog'
}

export default function KanbanBoard() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(new Set())
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    fetchTasks()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('agent_executions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_executions'
        },
        (payload) => {
          console.log('Realtime update:', payload)
          fetchTasks()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_tasks')
        .select(`
          *,
          agent:agents(name, description, tags),
          workflow:agent_workflows(id, name, user_prompt, status),
          execution:agent_executions(id, started_at, completed_at, output_summary, error_message, duration_seconds, cost_usd)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      // Transform executions to tasks
      const tasksData = (data || []).map(exec => ({
        id: exec.id,
        execution_id: exec.id,
        agent_id: exec.agent_id,
        title: exec.agent?.name || 'Unknown Agent',
        description: exec.agent?.description || '',
        tags: exec.agent?.tags || [],
        status: exec.status,
        stage: mapStatusToStage(exec.status),
        started_at: exec.started_at,
        completed_at: exec.completed_at,
        duration_seconds: exec.duration_seconds,
        cost_usd: parseFloat(exec.cost_usd) || 0,
        error_message: exec.error_message,
        output_summary: exec.output_summary,
        triggered_by: exec.triggered_by,
        created_at: exec.created_at,
      }))

      setTasks(tasksData)
    } catch (err) {
      console.error('Error fetching tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = async (result) => {
    if (!result.destination) return

    const { source, destination, draggableId } = result

    // Don't do anything if dropped in same position
    if (source.droppableId === destination.droppableId &&
        source.index === destination.index) {
      return
    }

    // Update local state immediately for smooth UX
    const task = tasks.find(t => t.id === draggableId)
    const newStage = destination.droppableId

    // Map stage back to execution status
    const stageToStatus = {
      queued: 'pending',
      in_progress: 'running',
      completed: 'completed',
      blocked: 'failed',
    }
    const newStatus = stageToStatus[newStage]

    if (!newStatus) return

    setTasks(prevTasks =>
      prevTasks.map(t =>
        t.id === draggableId
          ? { ...t, stage: newStage, status: newStatus }
          : t
      )
    )

    // Update in database
    try {
      const updateData = { status: newStatus }

      if (newStatus === 'running' && !task.started_at) {
        updateData.started_at = new Date().toISOString()
      }

      if (['completed', 'failed'].includes(newStatus) && !task.completed_at) {
        updateData.completed_at = new Date().toISOString()
        if (task.started_at) {
          const duration = Math.round((new Date() - new Date(task.started_at)) / 1000)
          updateData.duration_seconds = duration
        }
      }

      await supabase
        .from('agent_tasks')
        .update(updateData)
        .eq('id', draggableId)

    } catch (err) {
      console.error('Error updating task:', err)
      // Revert on error
      fetchTasks()
    }
  }

  const calculateProgress = (task) => {
    if (task.status !== 'running') return 0
    if (!task.started_at) return 10

    // Estimate progress based on time elapsed
    const elapsed = (new Date() - new Date(task.started_at)) / 1000
    const estimated = 60 // Assume 60s average execution
    const progress = Math.min(90, (elapsed / estimated) * 100)
    return Math.round(progress)
  }

  const handleCancel = async (taskId, event) => {
    // Stop event propagation to prevent drag
    event.stopPropagation()

    if (!window.confirm('Are you sure you want to cancel this execution?')) {
      return
    }

    setCancelling(prev => new Set(prev).add(taskId))

    try {
      const response = await fetch(`/api/execution-control/${taskId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel execution')
      }

      console.log('Execution cancelled:', data)
      // Refetch tasks to update UI
      await fetchTasks()
    } catch (err) {
      console.error('Error cancelling execution:', err)
      alert(`Failed to cancel execution: ${err.message}`)
    } finally {
      setCancelling(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Text>Loading executions...</Text>
      </div>
    )
  }

  const filteredTasks = statusFilter === 'all'
    ? tasks
    : tasks.filter(t => t.status === statusFilter)

  const renderLegend = () => (
    <div className="flex flex-wrap gap-2">
      <Badge
        color="gray"
        size="sm"
        className={`cursor-pointer ${statusFilter === 'all' ? 'ring-2 ring-offset-1 ring-[var(--mc-secondary)]' : ''}`}
        onClick={() => setStatusFilter('all')}
      >
        ALL
      </Badge>
      {['pending', 'running', 'completed', 'failed'].map(status => (
        <Badge
          key={status}
          color={getStatusColor(status)}
          size="sm"
          className={`cursor-pointer ${statusFilter === status ? 'ring-2 ring-offset-1 ring-[var(--mc-secondary)]' : ''}`}
          onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
        >
          {status.toUpperCase()}
        </Badge>
      ))}
    </div>
  )

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Badge color="gray" size="lg" className="mc-pill">Execution Board</Badge>
          {renderLegend()}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={fetchTasks}
          icon={RefreshCw}
          className="bg-[var(--mc-secondary)] text-white border-none hover:bg-[var(--mc-secondary-dark)]"
        >
          Refresh
        </Button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageTasks = filteredTasks.filter(t => t.stage === stage.id)

          return (
            <div key={stage.id} className="flex-shrink-0 w-80">
              <div className="mb-3 sticky top-2 z-10">
                <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-white shadow-sm border border-gray-200">
                  <Badge color={stage.color} size="xl" className="text-base px-4 py-2 font-bold">
                    {stage.label}
                  </Badge>
                  <Text className="text-sm text-gray-600 font-semibold">{stageTasks.length}</Text>
                </div>
              </div>

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`mc-kanban-column ${
                      snapshot.isDraggingOver ? 'is-dragging-over' : ''
                    }`}
                  >
                    {stageTasks.map((task, index) => (
                      <Draggable
                        key={task.id}
                        draggableId={task.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`mc-kanban-card ${
                              snapshot.isDragging ? 'is-dragging' : ''
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(task.status)}
                                  <Text className="font-semibold text-gray-900 text-sm">
                                    {task.title}
                                  </Text>
                                </div>
                                <div className="text-right">
                                  <Badge color={getStatusColor(task.status)} size="sm" className="font-semibold">
                                    {task.status.toUpperCase()}
                                  </Badge>
                                  <div className="flex gap-2 text-[11px] text-gray-600 justify-end mt-1">
                                    {task.duration_seconds ? <span>⏱ {task.duration_seconds}s</span> : null}
                                    {task.cost_usd > 0 ? <span>💲{task.cost_usd.toFixed(2)}</span> : null}
                                  </div>
                                </div>
                              </div>

                              {task.description && (
                                <Text className="text-[13px] text-gray-700 line-clamp-2">
                                  {task.description}
                                </Text>
                              )}

                              {task.status === 'running' && (
                                <ProgressBar
                                  value={calculateProgress(task)}
                                  color="amber"
                                  className="mt-1"
                                />
                              )}

                              {/* Cancel Button for Pending/Running */}
                              {(task.status === 'pending' || task.status === 'running') && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  color="red"
                                  icon={StopCircle}
                                  onClick={(e) => handleCancel(task.id, e)}
                                  disabled={cancelling.has(task.id)}
                                  className="w-full border-red-200 text-red-700 hover:bg-red-50"
                                >
                                  {cancelling.has(task.id) ? 'Cancelling...' : 'Cancel'}
                                </Button>
                              )}

                              <div className="flex flex-wrap gap-1">
                                {(task.tags || []).slice(0, 3).map(tag => (
                                  <Badge key={tag} color="gray" size="xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>

                              <div className="pt-2 border-t border-dashed border-gray-200 space-y-1">
                                <Text className="text-[11px] text-gray-600 font-medium">
                                  {task.created_at && formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                                </Text>

                                {task.error_message && (
                                  <Text className="text-[11px] text-red-700 font-semibold mt-1 line-clamp-2">
                                    Error: {task.error_message}
                                  </Text>
                                )}
                              </div>
                            </div>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {stageTasks.length === 0 && (
                      <Text className="text-center text-gray-400 py-8">
                        No tasks
                      </Text>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
