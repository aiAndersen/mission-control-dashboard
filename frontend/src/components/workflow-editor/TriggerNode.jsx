import React from 'react'
import { Handle, Position } from 'reactflow'
import { PlayIcon } from '@heroicons/react/24/solid'

/**
 * TriggerNode - Starting node for workflow execution
 *
 * Props:
 * - data.label: Display label (e.g., "Start Workflow")
 * - data.description: Optional description
 */
export default function TriggerNode({ data, selected }) {
  return (
    <div
      className="trigger-node"
      style={{
        minWidth: '220px',
        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        border: `2px solid ${selected ? '#10b981' : '#059669'}`,
        borderRadius: '12px',
        boxShadow: selected
          ? '0 6px 16px rgba(5, 150, 105, 0.3)'
          : '0 4px 12px rgba(5, 150, 105, 0.2)',
        padding: '16px',
        color: 'white',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <PlayIcon className="h-6 w-6" />
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '700' }}>
            {data.label || 'Start Workflow'}
          </div>
          {data.description && (
            <div
              style={{
                fontSize: '12px',
                marginTop: '4px',
                opacity: 0.9
              }}
            >
              {data.description}
            </div>
          )}
        </div>
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: '#10b981',
          width: '12px',
          height: '12px',
          border: '3px solid white'
        }}
      />
    </div>
  )
}
