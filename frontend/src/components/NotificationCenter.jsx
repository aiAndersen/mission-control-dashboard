import { useState, useEffect, useRef } from 'react'
import { Badge, Text } from '@tremor/react'
import { BellIcon, CheckCircleIcon, XCircleIcon, PlayIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { supabase } from '../services/supabase'

const MAX_NOTIFICATIONS = 50

function getNotificationIcon(type) {
  const icons = {
    'agent_running': PlayIcon,
    'agent_completed': CheckCircleIcon,
    'agent_failed': XCircleIcon,
    'workflow_completed': CheckCircleIcon,
    'workflow_failed': XCircleIcon,
    'approval_needed': ExclamationTriangleIcon,
  }
  return icons[type] || BellIcon
}

function getNotificationColor(type) {
  const colors = {
    'agent_running': 'text-blue-500',
    'agent_completed': 'text-emerald-500',
    'agent_failed': 'text-red-500',
    'workflow_completed': 'text-emerald-600',
    'workflow_failed': 'text-red-600',
    'approval_needed': 'text-amber-500',
  }
  return colors[type] || 'text-gray-500'
}

function getBgColor(type) {
  const colors = {
    'agent_running': 'bg-blue-50 border-blue-200',
    'agent_completed': 'bg-emerald-50 border-emerald-200',
    'agent_failed': 'bg-red-50 border-red-200',
    'workflow_completed': 'bg-emerald-50 border-emerald-200',
    'workflow_failed': 'bg-red-50 border-red-200',
    'approval_needed': 'bg-amber-50 border-amber-200',
  }
  return colors[type] || 'bg-gray-50 border-gray-200'
}

export default function NotificationCenter({ onApprovalClick }) {
  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const panelRef = useRef(null)
  const lastReadRef = useRef(Date.now())

  useEffect(() => {
    // Subscribe to agent_executions changes
    const execSubscription = supabase
      .channel('notification_executions')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agent_executions'
      }, (payload) => {
        const exec = payload.new
        let type = null
        let message = ''

        if (exec.status === 'running') {
          type = 'agent_running'
          message = `Agent started executing`
        } else if (exec.status === 'completed') {
          type = 'agent_completed'
          const duration = exec.duration_seconds ? ` in ${exec.duration_seconds}s` : ''
          message = `Agent completed successfully${duration}`
        } else if (exec.status === 'failed') {
          type = 'agent_failed'
          message = exec.error_message
            ? `Agent failed: ${exec.error_message.substring(0, 80)}`
            : 'Agent execution failed'
        }

        if (type) {
          addNotification({
            type,
            message,
            workflowId: exec.workflow_id,
            executionId: exec.id,
            stepOrder: exec.step_order,
            timestamp: Date.now()
          })
        }
      })
      .subscribe()

    // Subscribe to agent_workflows changes
    const workflowSubscription = supabase
      .channel('notification_workflows')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'agent_workflows'
      }, (payload) => {
        const wf = payload.new
        let type = null
        let message = ''

        if (wf.status === 'completed') {
          type = 'workflow_completed'
          message = `Workflow "${wf.name}" completed successfully`
        } else if (wf.status === 'failed') {
          type = 'workflow_failed'
          message = `Workflow "${wf.name}" failed`
        }

        if (type) {
          addNotification({
            type,
            message,
            workflowId: wf.id,
            workflowName: wf.name,
            timestamp: Date.now()
          })
        }
      })
      .subscribe()

    // Subscribe to approval requests
    const approvalSubscription = supabase
      .channel('notification_approvals')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'workflow_approvals'
      }, (payload) => {
        const approval = payload.new
        if (approval.status === 'pending') {
          addNotification({
            type: 'approval_needed',
            message: `Action required: workflow step needs your approval`,
            workflowId: approval.workflow_id,
            approvalId: approval.id,
            approvalData: approval,
            timestamp: Date.now()
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(execSubscription)
      supabase.removeChannel(workflowSubscription)
      supabase.removeChannel(approvalSubscription)
    }
  }, [])

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const addNotification = (notification) => {
    setNotifications(prev => {
      const updated = [notification, ...prev].slice(0, MAX_NOTIFICATIONS)
      return updated
    })
    setUnreadCount(prev => prev + 1)
  }

  const handleOpen = () => {
    setIsOpen(prev => !prev)
    if (!isOpen) {
      lastReadRef.current = Date.now()
      setUnreadCount(0)
    }
  }

  const dismissNotification = (idx) => {
    setNotifications(prev => prev.filter((_, i) => i !== idx))
  }

  const clearAll = () => {
    setNotifications([])
    setUnreadCount(0)
  }

  const handleNotificationClick = (notification) => {
    if (notification.type === 'approval_needed' && notification.approvalData && onApprovalClick) {
      onApprovalClick(notification.approvalData)
      setIsOpen(false)
    }
  }

  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors border border-white/30"
        title="Notifications"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border-2 border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <BellIcon className="h-5 w-5 text-gray-700" />
              <span className="font-semibold text-gray-900 text-sm">Notifications</span>
              {notifications.length > 0 && (
                <Badge color="gray" size="sm">{notifications.length}</Badge>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <BellIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <Text className="text-gray-500 text-sm">No notifications yet</Text>
                <Text className="text-gray-400 text-xs mt-1">Agent events will appear here in real-time</Text>
              </div>
            ) : (
              notifications.map((n, idx) => {
                const Icon = getNotificationIcon(n.type)
                const iconColor = getNotificationColor(n.type)
                const bgColor = getBgColor(n.type)
                const isClickable = n.type === 'approval_needed'

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-0 ${isClickable ? 'cursor-pointer hover:opacity-90' : ''} ${bgColor}`}
                    onClick={() => isClickable && handleNotificationClick(n)}
                  >
                    <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <Text className="text-sm text-gray-900 font-medium leading-tight">
                        {n.message}
                      </Text>
                      <div className="flex items-center gap-2 mt-1">
                        <Text className="text-xs text-gray-500">{formatTime(n.timestamp)}</Text>
                        {n.stepOrder && (
                          <Badge color="gray" size="xs">Step {n.stepOrder}</Badge>
                        )}
                        {n.type === 'approval_needed' && (
                          <Badge color="amber" size="xs">Action Required</Badge>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismissNotification(idx) }}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer hint */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
              <Text className="text-xs text-gray-500 text-center">
                Real-time updates from active workflows
              </Text>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
