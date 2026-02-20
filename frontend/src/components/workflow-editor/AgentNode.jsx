import React from 'react'
import { Handle, Position } from 'reactflow'
import {
  CpuChipIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  PlayIcon
} from '@heroicons/react/24/outline'

/**
 * AgentNode - Custom React Flow node for displaying workflow agents
 *
 * Props:
 * - data.step_number: Step number in workflow
 * - data.agent: Agent name
 * - data.description: Step description
 * - data.parameters: Agent parameters
 * - data.requires_approval: Boolean for approval gate
 * - data.status: 'pending' | 'running' | 'completed' | 'failed'
 */
export default function AgentNode({ data, selected }) {
  // Status configuration
  const statusConfig = {
    pending: {
      icon: ClockIcon,
      color: 'text-gray-400',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-300'
    },
    running: {
      icon: PlayIcon,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-500'
    },
    completed: {
      icon: CheckCircleIcon,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-500'
    },
    failed: {
      icon: ExclamationCircleIcon,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500'
    }
  }

  const status = data.status || 'pending'
  const StatusIcon = statusConfig[status].icon

  // Truncate description if too long
  const maxDescLength = 120
  const description = data.description && data.description.length > maxDescLength
    ? data.description.substring(0, maxDescLength) + '...'
    : data.description

  return (
    <div
      className={`agent-node ${selected ? 'selected' : ''}`}
      style={{
        minWidth: '320px',
        background: 'white',
        border: `2px solid ${selected ? '#00A8E1' : '#e5e7eb'}`,
        borderRadius: '8px',
        boxShadow: selected
          ? '0 4px 12px rgba(0, 168, 225, 0.2)'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#00A8E1',
          width: '10px',
          height: '10px',
          border: '2px solid white'
        }}
      />

      {/* Node Header */}
      <div
        className="node-header"
        style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #00A8E1 0%, #0096C9 100%)',
          color: 'white',
          borderTopLeftRadius: '6px',
          borderTopRightRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CpuChipIcon className="h-5 w-5" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>
              Step {data.step_number}: {data.agent}
            </div>
          </div>
        </div>
        {data.requires_approval && (
          <div
            style={{
              fontSize: '10px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: '500'
            }}
          >
            Approval Required
          </div>
        )}
      </div>

      {/* Node Body */}
      <div
        className="node-body"
        style={{
          padding: '12px 16px',
          minHeight: '60px'
        }}
      >
        <p
          style={{
            fontSize: '13px',
            color: '#374151',
            lineHeight: '1.5',
            margin: 0
          }}
        >
          {description || 'No description provided'}
        </p>

        {/* Parameters preview (if any) */}
        {data.parameters && Object.keys(data.parameters).length > 0 && (
          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: '#6b7280',
              fontFamily: 'monospace'
            }}
          >
            {Object.keys(data.parameters).length} parameter
            {Object.keys(data.parameters).length !== 1 ? 's' : ''} configured
          </div>
        )}
      </div>

      {/* Node Footer - Status */}
      <div
        className={`node-footer ${statusConfig[status].bgColor}`}
        style={{
          padding: '8px 16px',
          borderBottomLeftRadius: '6px',
          borderBottomRightRadius: '6px',
          borderTop: `1px solid ${statusConfig[status].borderColor}`,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        <StatusIcon className={`h-4 w-4 ${statusConfig[status].color}`} />
        <span
          style={{
            fontSize: '12px',
            fontWeight: '500',
            color: statusConfig[status].color.replace('text-', '#'),
            textTransform: 'capitalize'
          }}
          className={statusConfig[status].color}
        >
          {status}
        </span>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#00A8E1',
          width: '10px',
          height: '10px',
          border: '2px solid white'
        }}
      />
    </div>
  )
}
