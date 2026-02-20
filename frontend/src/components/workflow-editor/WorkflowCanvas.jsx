import React, { useCallback, useMemo } from 'react'
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'

import AgentNode from './AgentNode'
import TriggerNode from './TriggerNode'
import { planToNodes, autoLayout } from './conversion'

/**
 * WorkflowCanvas - React Flow wrapper for visualizing workflows
 *
 * Props:
 * - workflow: Workflow object with workflow_plan and visual_layout
 * - executionStatus: Optional object mapping step_number to status
 * - onNodeClick: Callback when node is clicked
 * - readOnly: Boolean to disable interactions (default: true for Phase 1)
 */
export default function WorkflowCanvas({
  workflow,
  executionStatus = {},
  onNodeClick,
  readOnly = true
}) {
  // Define custom node types
  const nodeTypes = useMemo(
    () => ({
      agent: AgentNode,
      trigger: TriggerNode
    }),
    []
  )

  // Convert workflow plan to React Flow format
  const initialData = useMemo(() => {
    if (!workflow || !workflow.workflow_plan) {
      return { nodes: [], edges: [] }
    }

    const { nodes, edges } = planToNodes(
      workflow.workflow_plan,
      workflow.visual_layout || {},
      executionStatus
    )

    // Apply auto-layout if no visual_layout is saved
    if (!workflow.visual_layout || Object.keys(workflow.visual_layout).length === 0) {
      return { nodes: autoLayout(nodes, edges), edges }
    }

    return { nodes, edges }
  }, [workflow, executionStatus])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges)

  // Update nodes when execution status changes
  React.useEffect(() => {
    if (!workflow || !workflow.workflow_plan) return

    const { nodes: updatedNodes } = planToNodes(
      workflow.workflow_plan,
      workflow.visual_layout || {},
      executionStatus
    )

    // Preserve positions from current nodes
    const nodesWithPositions = updatedNodes.map(updatedNode => {
      const existingNode = nodes.find(n => n.id === updatedNode.id)
      return existingNode
        ? { ...updatedNode, position: existingNode.position }
        : updatedNode
    })

    setNodes(nodesWithPositions)
  }, [executionStatus])

  // Handle node click
  const handleNodeClick = useCallback(
    (event, node) => {
      if (onNodeClick) {
        onNodeClick(node)
      }
    },
    [onNodeClick]
  )

  // Edge styling with animation for running steps
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: '#00A8E1'
      },
      style: {
        strokeWidth: 2,
        stroke: '#00A8E1'
      }
    }),
    []
  )

  // Empty state
  if (!workflow || !workflow.workflow_plan) {
    return (
      <div
        style={{
          height: '600px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '2px dashed #d1d5db'
        }}
      >
        <div style={{ textAlign: 'center', color: '#6b7280' }}>
          <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
            No Workflow Available
          </div>
          <div style={{ fontSize: '14px' }}>
            Create a workflow using the CEO Agent to see it visualized here
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '600px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={false}
        attributionPosition="bottom-left"
      >
        <Background color="#e5e7eb" gap={16} />
        <Controls
          style={{
            button: {
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '4px'
            }
          }}
        />
        <MiniMap
          nodeColor={(node) => {
            switch (node.type) {
              case 'trigger':
                return '#059669'
              case 'agent':
                return '#00A8E1'
              default:
                return '#94a3b8'
            }
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          style={{
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '4px'
          }}
        />
      </ReactFlow>
    </div>
  )
}
