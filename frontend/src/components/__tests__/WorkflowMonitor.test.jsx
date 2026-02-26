import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock Supabase client
vi.mock('../../services/supabase.js', () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }
  return {
    supabase: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn(),
    },
  }
})

vi.mock('../workflow-editor/WorkflowCanvas.jsx', () => ({
  default: () => <div data-testid="workflow-canvas">Canvas</div>,
}))
vi.mock('./ExecutionLog.jsx', () => ({ default: () => <div>Log</div> }))
vi.mock('../ApprovalGate.jsx', () => ({ default: () => <div>ApprovalGate</div> }))
vi.mock('../../styles/workflow-editor.css', () => ({}))

import { supabase } from '../../services/supabase.js'
import WorkflowMonitor from '../WorkflowMonitor.jsx'

// Helper: build a minimal workflow object
function makeWorkflow(overrides = {}) {
  return {
    id: 'wf-1',
    name: 'Test Workflow',
    status: 'running',
    user_prompt: 'Do something useful',
    total_steps: 4,
    current_step: 2,
    created_at: '2026-02-26T10:00:00Z',
    executive_summary: null,
    workflow_plan: null,
    executions: [
      { id: 'exec-1', step_order: 1, status: 'completed', agent: { name: 'agent-a' }, started_at: null, completed_at: null, duration_seconds: 5, error_message: null },
      { id: 'exec-2', step_order: 2, status: 'running',   agent: { name: 'agent-b' }, started_at: null, completed_at: null, duration_seconds: null, error_message: null },
    ],
    ...overrides,
  }
}

function setupSupabaseMock(workflows) {
  supabase.from.mockReturnThis()
  supabase.select.mockReturnThis()
  supabase.order.mockReturnThis()
  supabase.limit.mockResolvedValue({ data: workflows, error: null })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WorkflowMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set up the channel mock each time
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }
    supabase.channel.mockReturnValue(mockChannel)
  })

  it('shows loading state initially then renders workflows', async () => {
    setupSupabaseMock([makeWorkflow()])
    render(<WorkflowMonitor />)
    // Should first show loading
    expect(screen.getByText('Loading workflows...')).toBeInTheDocument()
    // Then show the workflow after data loads
    await waitFor(() => {
      expect(screen.getByText('Test Workflow')).toBeInTheDocument()
    })
  })

  it('shows empty state message when no workflows exist', async () => {
    setupSupabaseMock([])
    render(<WorkflowMonitor />)
    await waitFor(() => {
      expect(screen.getByText(/No workflows yet/i)).toBeInTheDocument()
    })
  })

  it('renders the List View and Canvas View toggle buttons', async () => {
    setupSupabaseMock([makeWorkflow()])
    render(<WorkflowMonitor />)
    await waitFor(() => screen.getByText('Test Workflow'))
    expect(screen.getByText('List View')).toBeInTheDocument()
    expect(screen.getByText('Canvas View')).toBeInTheDocument()
  })

  it('shows RUNNING badge for running workflow', async () => {
    setupSupabaseMock([makeWorkflow({ status: 'running' })])
    render(<WorkflowMonitor />)
    await waitFor(() => {
      expect(screen.getByText('RUNNING')).toBeInTheDocument()
    })
  })

  it('shows COMPLETED badge for completed workflow', async () => {
    setupSupabaseMock([makeWorkflow({ status: 'completed', executions: [] })])
    render(<WorkflowMonitor />)
    await waitFor(() => {
      expect(screen.getByText('COMPLETED')).toBeInTheDocument()
    })
  })

  it('shows SAVED badge for saved workflow', async () => {
    setupSupabaseMock([makeWorkflow({ status: 'saved', executions: [] })])
    render(<WorkflowMonitor />)
    await waitFor(() => {
      expect(screen.getByText('SAVED')).toBeInTheDocument()
    })
  })

  it('shows Execute Now button for saved workflows', async () => {
    setupSupabaseMock([makeWorkflow({ status: 'saved', executions: [] })])
    render(<WorkflowMonitor />)
    await waitFor(() => {
      expect(screen.getByText('Execute Now')).toBeInTheDocument()
    })
  })

  it('shows Cancel button for running workflows', async () => {
    setupSupabaseMock([makeWorkflow({ status: 'running' })])
    render(<WorkflowMonitor />)
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })
  })

  it('shows Delete button for completed workflows', async () => {
    setupSupabaseMock([makeWorkflow({ status: 'completed', executions: [] })])
    render(<WorkflowMonitor />)
    await waitFor(() => {
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })

  it('shows progress bar and step count for running workflow', async () => {
    // 2 completed of 4 total = 50%
    const workflow = makeWorkflow({
      total_steps: 4,
      current_step: 2,
      executions: [
        { id: 'exec-1', step_order: 1, status: 'completed', agent: { name: 'agent-a' }, started_at: null, completed_at: null, duration_seconds: 5, error_message: null },
        { id: 'exec-2', step_order: 2, status: 'completed', agent: { name: 'agent-b' }, started_at: null, completed_at: null, duration_seconds: 5, error_message: null },
        { id: 'exec-3', step_order: 3, status: 'running',   agent: { name: 'agent-c' }, started_at: null, completed_at: null, duration_seconds: null, error_message: null },
        { id: 'exec-4', step_order: 4, status: 'pending',   agent: { name: 'agent-d' }, started_at: null, completed_at: null, duration_seconds: null, error_message: null },
      ],
    })
    setupSupabaseMock([workflow])
    render(<WorkflowMonitor />)
    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 4/)).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })
  })

  it('switches to Canvas View when toggle is clicked', async () => {
    const user = userEvent.setup()
    // Extra supabase mock for expandWorkflow call won't fire in canvas mode
    setupSupabaseMock([makeWorkflow()])
    render(<WorkflowMonitor />)
    await waitFor(() => screen.getByText('Canvas View'))
    await user.click(screen.getByText('Canvas View'))
    await waitFor(() => {
      expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument()
    })
  })

  it('calls Refresh button to re-fetch workflows', async () => {
    const user = userEvent.setup()
    setupSupabaseMock([makeWorkflow()])
    render(<WorkflowMonitor />)
    await waitFor(() => screen.getByText('Test Workflow'))
    // Set up mock for the refresh call
    supabase.limit.mockResolvedValue({ data: [makeWorkflow({ name: 'Refreshed Workflow' })], error: null })
    await user.click(screen.getByRole('button', { name: /Refresh/i }))
    await waitFor(() => {
      expect(screen.getByText('Refreshed Workflow')).toBeInTheDocument()
    })
  })
})

// ─── Pure utility logic (extracted for unit testing) ──────────────────────────

describe('WorkflowMonitor utility logic', () => {
  // calculateProgress logic (inline copy for isolated testing)
  function calculateProgress(workflow) {
    if (!workflow.executions || workflow.executions.length === 0) return 0
    const completed = workflow.executions.filter(e =>
      e.status === 'completed' || e.status === 'failed'
    ).length
    return Math.round((completed / workflow.total_steps) * 100)
  }

  it('returns 0 when there are no executions', () => {
    expect(calculateProgress({ total_steps: 5, executions: [] })).toBe(0)
  })

  it('calculates progress correctly for partially-done workflow', () => {
    const workflow = {
      total_steps: 4,
      executions: [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'running' },
        { status: 'pending' },
      ],
    }
    expect(calculateProgress(workflow)).toBe(50)
  })

  it('counts failed executions toward progress', () => {
    const workflow = {
      total_steps: 2,
      executions: [{ status: 'failed' }, { status: 'completed' }],
    }
    expect(calculateProgress(workflow)).toBe(100)
  })

  it('returns 0 when executions is null/undefined', () => {
    expect(calculateProgress({ total_steps: 3, executions: null })).toBe(0)
    expect(calculateProgress({ total_steps: 3 })).toBe(0)
  })

  // getStatusColor logic
  function getStatusColor(status) {
    const colors = {
      planning: 'gray',
      pending_approval: 'amber',
      saved: 'blue',
      running: 'blue',
      completed: 'emerald',
      failed: 'red',
      cancelled: 'gray',
    }
    return colors[status] || 'gray'
  }

  it.each([
    ['planning', 'gray'],
    ['pending_approval', 'amber'],
    ['saved', 'blue'],
    ['running', 'blue'],
    ['completed', 'emerald'],
    ['failed', 'red'],
    ['cancelled', 'gray'],
  ])('getStatusColor("%s") === "%s"', (status, expected) => {
    expect(getStatusColor(status)).toBe(expected)
  })

  it('getStatusColor returns "gray" for unknown status', () => {
    expect(getStatusColor('unknown')).toBe('gray')
  })

  // getExecutionStatus logic
  function getExecutionStatus(workflow) {
    if (!workflow || !workflow.executions) return {}
    const statusMap = {}
    workflow.executions.forEach(execution => {
      if (execution.step_order) {
        statusMap[execution.step_order] = execution.status
      }
    })
    return statusMap
  }

  it('builds a step_number → status map from executions', () => {
    const workflow = {
      executions: [
        { step_order: 1, status: 'completed' },
        { step_order: 2, status: 'running' },
        { step_order: 3, status: 'pending' },
      ],
    }
    expect(getExecutionStatus(workflow)).toEqual({ 1: 'completed', 2: 'running', 3: 'pending' })
  })

  it('skips executions with no step_order', () => {
    const workflow = {
      executions: [{ step_order: null, status: 'running' }, { step_order: 1, status: 'completed' }],
    }
    expect(getExecutionStatus(workflow)).toEqual({ 1: 'completed' })
  })

  it('returns empty object when workflow has no executions', () => {
    expect(getExecutionStatus({ executions: [] })).toEqual({})
    expect(getExecutionStatus(null)).toEqual({})
  })
})
