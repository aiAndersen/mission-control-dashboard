import { describe, it, expect, vi } from 'vitest'

// Mock dagre for autoLayout tests to avoid graph layout dependency
vi.mock('dagre', () => {
  const mockGraph = {
    setDefaultEdgeLabel: vi.fn(),
    setGraph: vi.fn(),
    setNode: vi.fn(),
    setEdge: vi.fn(),
    node: vi.fn((id) => ({ x: 250, y: 100 })),
  }
  return {
    default: {
      graphlib: { Graph: vi.fn(() => mockGraph) },
      layout: vi.fn(),
    },
  }
})

import {
  planToNodes,
  nodesToPlan,
  validateWorkflow,
  extractVisualLayout,
  renumberSteps,
} from '../conversion.js'

// ─── planToNodes ──────────────────────────────────────────────────────────────

describe('planToNodes', () => {
  const samplePlan = {
    title: 'Test Workflow',
    description: 'A test workflow',
    steps: [
      { step_number: 1, agent: 'agent-a', description: 'Step one', parameters: {}, requires_approval: false },
      { step_number: 2, agent: 'agent-b', description: 'Step two', parameters: { '--input': 'file.csv' }, requires_approval: true },
    ],
  }

  it('returns empty nodes and edges for null plan', () => {
    const result = planToNodes(null)
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
  })

  it('returns empty nodes and edges when steps is missing', () => {
    const result = planToNodes({ title: 'No steps' })
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
  })

  it('returns empty nodes and edges when steps is not an array', () => {
    const result = planToNodes({ steps: 'not-an-array' })
    expect(result.nodes).toEqual([])
    expect(result.edges).toEqual([])
  })

  it('creates a trigger node plus one agent node per step', () => {
    const { nodes } = planToNodes(samplePlan)
    expect(nodes).toHaveLength(3) // trigger + 2 steps
    expect(nodes[0].id).toBe('trigger')
    expect(nodes[0].type).toBe('trigger')
    expect(nodes[1].id).toBe('step-1')
    expect(nodes[2].id).toBe('step-2')
  })

  it('creates correct edges linking trigger → step-1 → step-2', () => {
    const { edges } = planToNodes(samplePlan)
    expect(edges).toHaveLength(2)
    expect(edges[0].source).toBe('trigger')
    expect(edges[0].target).toBe('step-1')
    expect(edges[1].source).toBe('step-1')
    expect(edges[1].target).toBe('step-2')
  })

  it('sets animated=true for edges whose step is running', () => {
    const { edges } = planToNodes(samplePlan, {}, { 1: 'running' })
    expect(edges[0].animated).toBe(true)
    expect(edges[1].animated).toBe(false)
  })

  it('maps execution status into node data', () => {
    const { nodes } = planToNodes(samplePlan, {}, { 1: 'completed', 2: 'running' })
    const step1 = nodes.find(n => n.id === 'step-1')
    const step2 = nodes.find(n => n.id === 'step-2')
    expect(step1.data.status).toBe('completed')
    expect(step2.data.status).toBe('running')
  })

  it('defaults missing execution status to "pending"', () => {
    const { nodes } = planToNodes(samplePlan)
    const step1 = nodes.find(n => n.id === 'step-1')
    expect(step1.data.status).toBe('pending')
  })

  it('uses visualLayout positions when provided', () => {
    const layout = { trigger: { x: 10, y: 20 }, 'step-1': { x: 30, y: 40 } }
    const { nodes } = planToNodes(samplePlan, layout)
    expect(nodes[0].position).toEqual({ x: 10, y: 20 })
    expect(nodes.find(n => n.id === 'step-1').position).toEqual({ x: 30, y: 40 })
  })

  it('preserves requires_approval flag on agent nodes', () => {
    const { nodes } = planToNodes(samplePlan)
    const step2 = nodes.find(n => n.id === 'step-2')
    expect(step2.data.requires_approval).toBe(true)
  })
})

// ─── nodesToPlan ──────────────────────────────────────────────────────────────

describe('nodesToPlan', () => {
  const sampleNodes = [
    { id: 'trigger', type: 'trigger', data: { label: 'Start' } },
    { id: 'step-1', type: 'agent', data: { step_number: 1, agent: 'agent-a', description: 'Do thing A', parameters: {}, requires_approval: false } },
    { id: 'step-2', type: 'agent', data: { step_number: 2, agent: 'agent-b', description: 'Do thing B', parameters: { '--flag': 'val' }, requires_approval: true } },
  ]
  const sampleEdges = []

  it('converts agent nodes back to steps array', () => {
    const plan = nodesToPlan(sampleNodes, sampleEdges)
    expect(plan.steps).toHaveLength(2)
    expect(plan.steps[0].agent).toBe('agent-a')
    expect(plan.steps[1].agent).toBe('agent-b')
  })

  it('excludes trigger node from steps', () => {
    const plan = nodesToPlan(sampleNodes, sampleEdges)
    expect(plan.steps.every(s => s.agent !== undefined)).toBe(true)
  })

  it('renumbers steps sequentially starting at 1', () => {
    const plan = nodesToPlan(sampleNodes, sampleEdges)
    expect(plan.steps[0].step_number).toBe(1)
    expect(plan.steps[1].step_number).toBe(2)
  })

  it('preserves step parameters', () => {
    const plan = nodesToPlan(sampleNodes, sampleEdges)
    expect(plan.steps[1].parameters).toEqual({ '--flag': 'val' })
  })

  it('preserves requires_approval flag', () => {
    const plan = nodesToPlan(sampleNodes, sampleEdges)
    expect(plan.steps[1].requires_approval).toBe(true)
  })
})

// ─── validateWorkflow ─────────────────────────────────────────────────────────

describe('validateWorkflow', () => {
  const validNodes = [
    { id: 'trigger', type: 'trigger', data: {} },
    { id: 'step-1', type: 'agent', data: { step_number: 1, agent: 'agent-a', description: 'Do something' } },
  ]
  const validEdges = [
    { id: 'e1', source: 'trigger', target: 'step-1' },
  ]

  it('returns isValid=true for a well-formed workflow', () => {
    const result = validateWorkflow(validNodes, validEdges)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('flags when there are no agent nodes', () => {
    const result = validateWorkflow(
      [{ id: 'trigger', type: 'trigger', data: {} }],
      []
    )
    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('Workflow must have at least one agent step')
  })

  it('flags agent node missing agent name', () => {
    const nodes = [
      { id: 'trigger', type: 'trigger', data: {} },
      { id: 'step-1', type: 'agent', data: { step_number: 1, agent: '', description: 'Some task' } },
    ]
    const edges = [{ id: 'e1', source: 'trigger', target: 'step-1' }]
    const result = validateWorkflow(nodes, edges)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.includes('Agent is required'))).toBe(true)
  })

  it('flags agent node with empty description', () => {
    const nodes = [
      { id: 'trigger', type: 'trigger', data: {} },
      { id: 'step-1', type: 'agent', data: { step_number: 1, agent: 'agent-a', description: '' } },
    ]
    const edges = [{ id: 'e1', source: 'trigger', target: 'step-1' }]
    const result = validateWorkflow(nodes, edges)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.includes('Description is required'))).toBe(true)
  })

  it('flags unreachable step nodes', () => {
    const nodes = [
      { id: 'trigger', type: 'trigger', data: {} },
      { id: 'step-1', type: 'agent', data: { step_number: 1, agent: 'agent-a', description: 'A' } },
      { id: 'step-2', type: 'agent', data: { step_number: 2, agent: 'agent-b', description: 'B' } },
    ]
    // step-2 is disconnected
    const edges = [{ id: 'e1', source: 'trigger', target: 'step-1' }]
    const result = validateWorkflow(nodes, edges)
    expect(result.isValid).toBe(false)
    expect(result.errors.some(e => e.includes('Unreachable steps'))).toBe(true)
  })
})

// ─── extractVisualLayout ──────────────────────────────────────────────────────

describe('extractVisualLayout', () => {
  it('extracts {x, y} positions keyed by node id', () => {
    const nodes = [
      { id: 'trigger', position: { x: 10, y: 20 } },
      { id: 'step-1', position: { x: 30, y: 40 } },
    ]
    const layout = extractVisualLayout(nodes)
    expect(layout).toEqual({
      trigger: { x: 10, y: 20 },
      'step-1': { x: 30, y: 40 },
    })
  })

  it('returns empty object for empty nodes array', () => {
    expect(extractVisualLayout([])).toEqual({})
  })
})

// ─── renumberSteps ────────────────────────────────────────────────────────────

describe('renumberSteps', () => {
  it('assigns sequential step numbers based on graph order', () => {
    const nodes = [
      { id: 'trigger', type: 'trigger', data: {} },
      { id: 'step-1', type: 'agent', data: { step_number: 5, agent: 'a', description: 'A' } },
      { id: 'step-2', type: 'agent', data: { step_number: 3, agent: 'b', description: 'B' } },
    ]
    const edges = [
      { source: 'trigger', target: 'step-1' },
      { source: 'step-1', target: 'step-2' },
    ]
    const result = renumberSteps(nodes, edges)
    const agent1 = result.find(n => n.id === 'step-1')
    const agent2 = result.find(n => n.id === 'step-2')
    expect(agent1.data.step_number).toBe(1)
    expect(agent2.data.step_number).toBe(2)
  })

  it('preserves non-agent nodes unchanged', () => {
    const nodes = [
      { id: 'trigger', type: 'trigger', data: { label: 'Start' } },
      { id: 'step-1', type: 'agent', data: { step_number: 1, agent: 'a', description: 'A' } },
    ]
    const edges = [{ source: 'trigger', target: 'step-1' }]
    const result = renumberSteps(nodes, edges)
    const trigger = result.find(n => n.id === 'trigger')
    expect(trigger.data.label).toBe('Start')
  })
})
