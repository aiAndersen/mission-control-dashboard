import dagre from 'dagre'

/**
 * Convert workflow_plan JSON to React Flow format
 *
 * @param {Object} workflowPlan - Workflow plan from database { title, description, steps: [...] }
 * @param {Object} visualLayout - Optional saved node positions { nodeId: {x, y} }
 * @param {Object} executionStatus - Optional execution status for each step { stepNumber: 'pending|running|completed|failed' }
 * @returns {Object} { nodes: WorkflowNode[], edges: WorkflowEdge[] }
 */
export function planToNodes(workflowPlan, visualLayout = {}, executionStatus = {}) {
  if (!workflowPlan || !workflowPlan.steps || !Array.isArray(workflowPlan.steps)) {
    return { nodes: [], edges: [] }
  }

  const nodes = []
  const edges = []

  // Create trigger/start node
  const triggerNode = {
    id: 'trigger',
    type: 'trigger',
    position: visualLayout['trigger'] || { x: 250, y: 50 },
    data: {
      label: 'Start Workflow',
      description: workflowPlan.description || 'Workflow execution starts here'
    }
  }
  nodes.push(triggerNode)

  // Create agent nodes for each step
  workflowPlan.steps.forEach((step, index) => {
    const nodeId = `step-${step.step_number}`

    const node = {
      id: nodeId,
      type: 'agent',
      position: visualLayout[nodeId] || { x: 250, y: 150 + (index * 120) },
      data: {
        step_number: step.step_number,
        agent: step.agent,
        description: step.description || '',
        parameters: step.parameters || {},
        requires_approval: step.requires_approval || false,
        status: executionStatus[step.step_number] || 'pending'
      }
    }
    nodes.push(node)

    // Create edge from previous node
    const sourceId = index === 0 ? 'trigger' : `step-${workflowPlan.steps[index - 1].step_number}`
    const edge = {
      id: `edge-${sourceId}-${nodeId}`,
      source: sourceId,
      target: nodeId,
      type: 'smoothstep',
      animated: executionStatus[step.step_number] === 'running'
    }
    edges.push(edge)
  })

  return { nodes, edges }
}

/**
 * Convert React Flow format back to workflow_plan JSON
 *
 * @param {Array} nodes - React Flow nodes array
 * @param {Array} edges - React Flow edges array
 * @returns {Object} Workflow plan { title, description, steps: [...] }
 */
export function nodesToPlan(nodes, edges) {
  // Filter out trigger node and get agent nodes
  const agentNodes = nodes.filter(node => node.type === 'agent')

  // Sort nodes by step_number
  agentNodes.sort((a, b) => a.data.step_number - b.data.step_number)

  // Renumber steps to ensure sequential numbering
  const steps = agentNodes.map((node, index) => ({
    step_number: index + 1,
    agent: node.data.agent,
    description: node.data.description,
    parameters: node.data.parameters || {},
    requires_approval: node.data.requires_approval || false
  }))

  return {
    steps
  }
}

/**
 * Auto-layout nodes vertically with spacing using dagre
 *
 * @param {Array} nodes - React Flow nodes array
 * @param {Array} edges - React Flow edges array
 * @param {String} direction - Layout direction: 'TB' (top-bottom) or 'LR' (left-right)
 * @returns {Array} Nodes with updated positions
 */
export function autoLayout(nodes, edges, direction = 'TB') {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  const nodeWidth = 320
  const nodeHeight = 100

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 50,      // Horizontal spacing between nodes
    ranksep: 100,     // Vertical spacing between ranks
    marginx: 50,
    marginy: 50
  })

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight
    })
  })

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  // Calculate layout
  dagre.layout(dagreGraph)

  // Apply calculated positions to nodes
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)

    return {
      ...node,
      position: {
        // Center the node based on dagre's center point
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2
      }
    }
  })
}

/**
 * Extract visual layout for database persistence
 *
 * @param {Array} nodes - React Flow nodes array
 * @returns {Object} Visual layout { nodeId: {x, y} }
 */
export function extractVisualLayout(nodes) {
  const layout = {}

  nodes.forEach(node => {
    layout[node.id] = {
      x: node.position.x,
      y: node.position.y
    }
  })

  return layout
}

/**
 * Validate workflow structure
 *
 * @param {Array} nodes - React Flow nodes array
 * @param {Array} edges - React Flow edges array
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
export function validateWorkflow(nodes, edges) {
  const errors = []

  // Check for at least one agent node
  const agentNodes = nodes.filter(n => n.type === 'agent')
  if (agentNodes.length === 0) {
    errors.push('Workflow must have at least one agent step')
  }

  // Check all agent nodes have required data
  agentNodes.forEach(node => {
    if (!node.data.agent) {
      errors.push(`Step ${node.data.step_number}: Agent is required`)
    }
    if (!node.data.description || node.data.description.trim() === '') {
      errors.push(`Step ${node.data.step_number}: Description is required`)
    }
  })

  // Check connectivity (all nodes should be reachable from trigger)
  const triggerNode = nodes.find(n => n.type === 'trigger')
  if (triggerNode) {
    const reachable = new Set(['trigger'])
    let changed = true

    while (changed) {
      changed = false
      edges.forEach(edge => {
        if (reachable.has(edge.source) && !reachable.has(edge.target)) {
          reachable.add(edge.target)
          changed = true
        }
      })
    }

    const unreachableNodes = agentNodes.filter(n => !reachable.has(n.id))
    if (unreachableNodes.length > 0) {
      errors.push(`Unreachable steps: ${unreachableNodes.map(n => n.data.step_number).join(', ')}`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Renumber workflow steps sequentially based on edge connections
 *
 * @param {Array} nodes - React Flow nodes array
 * @param {Array} edges - React Flow edges array
 * @returns {Array} Nodes with updated step numbers
 */
export function renumberSteps(nodes, edges) {
  const agentNodes = nodes.filter(n => n.type === 'agent')
  const otherNodes = nodes.filter(n => n.type !== 'agent')

  // Build adjacency list
  const adjacency = {}
  edges.forEach(edge => {
    if (!adjacency[edge.source]) adjacency[edge.source] = []
    adjacency[edge.source].push(edge.target)
  })

  // Topological sort starting from trigger
  const sorted = []
  const visited = new Set()

  function dfs(nodeId) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const neighbors = adjacency[nodeId] || []
    neighbors.forEach(neighbor => {
      dfs(neighbor)
    })

    // Only add agent nodes to sorted list
    const node = agentNodes.find(n => n.id === nodeId)
    if (node) {
      sorted.unshift(node)
    }
  }

  dfs('trigger')

  // Assign new step numbers
  const renumbered = sorted.map((node, index) => ({
    ...node,
    data: {
      ...node.data,
      step_number: index + 1
    }
  }))

  return [...otherNodes, ...renumbered]
}
