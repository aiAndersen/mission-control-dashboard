import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkflowCreator from '../WorkflowCreator.jsx'

// Mock WorkflowCanvas to avoid ReactFlow DOM complexity
vi.mock('../workflow-editor/WorkflowCanvas.jsx', () => ({
  default: () => <div data-testid="workflow-canvas">Canvas</div>,
}))

// Mock CSS imports
vi.mock('../../styles/workflow-editor.css', () => ({}))

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('WorkflowCreator', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the task description textarea', () => {
    render(<WorkflowCreator />)
    expect(screen.getByPlaceholderText(/Check system health/i)).toBeInTheDocument()
  })

  it('renders the Generate Plan button', () => {
    render(<WorkflowCreator />)
    expect(screen.getByText('Generate Plan')).toBeInTheDocument()
  })

  it('Generate Plan button is disabled when prompt is empty', () => {
    render(<WorkflowCreator />)
    // Tremor Button passes disabled to the underlying button
    const btn = screen.getByRole('button', { name: /Generate Plan/i })
    expect(btn).toBeDisabled()
  })

  it('Generate Plan button becomes enabled after typing a prompt', async () => {
    const user = userEvent.setup()
    render(<WorkflowCreator />)
    const textarea = screen.getByPlaceholderText(/Check system health/i)
    await user.type(textarea, 'Run a health check')
    const btn = screen.getByRole('button', { name: /Generate Plan/i })
    expect(btn).not.toBeDisabled()
  })

  it('shows error callout when API returns an error', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'OpenAI timeout' }),
    })

    render(<WorkflowCreator />)
    const textarea = screen.getByPlaceholderText(/Check system health/i)
    await user.type(textarea, 'some task')
    await user.click(screen.getByRole('button', { name: /Generate Plan/i }))

    await waitFor(() => {
      expect(screen.getByText('OpenAI timeout')).toBeInTheDocument()
    })
  })

  it('shows the plan review section after successful plan generation', async () => {
    const user = userEvent.setup()
    const planData = {
      workflow_name: 'Health Check Workflow',
      reasoning: 'Checks system components.',
      estimated_duration_minutes: 5,
      estimated_cost: 0.02,
      steps: [
        { step_number: 1, agent: 'qa-tester', description: 'Run health checks', parameters: {}, requires_approval: false },
      ],
      new_agents_needed: [],
    }
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ plan: planData }),
    })

    render(<WorkflowCreator />)
    const textarea = screen.getByPlaceholderText(/Check system health/i)
    await user.type(textarea, 'run health check')
    await user.click(screen.getByRole('button', { name: /Generate Plan/i }))

    await waitFor(() => {
      expect(screen.getByText('Review & Approve Plan')).toBeInTheDocument()
    })
    expect(screen.getByText('Health Check Workflow')).toBeInTheDocument()
    expect(screen.getByText('Checks system components.')).toBeInTheDocument()
  })

  it('displays step count, duration, and cost badges in plan overview', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: {
          workflow_name: 'My Workflow',
          reasoning: 'Reason',
          estimated_duration_minutes: 10,
          estimated_cost: 0.05,
          steps: [
            { step_number: 1, agent: 'agent-a', description: 'Step A', parameters: {}, requires_approval: false },
            { step_number: 2, agent: 'agent-b', description: 'Step B', parameters: {}, requires_approval: false },
          ],
          new_agents_needed: [],
        },
      }),
    })

    render(<WorkflowCreator />)
    await user.type(screen.getByPlaceholderText(/Check system health/i), 'do work')
    await user.click(screen.getByRole('button', { name: /Generate Plan/i }))

    await waitFor(() => screen.getByText('Review & Approve Plan'))
    expect(screen.getByText('2 Steps')).toBeInTheDocument()
    expect(screen.getByText(/10 min/)).toBeInTheDocument()
    expect(screen.getByText(/\$0.05/)).toBeInTheDocument()
  })

  it('shows human approval notice when a step requires approval', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: {
          workflow_name: 'Approval Workflow',
          reasoning: 'Needs approval',
          estimated_duration_minutes: 3,
          estimated_cost: 0,
          steps: [
            { step_number: 1, agent: 'agent-a', description: 'Critical action', parameters: {}, requires_approval: true },
          ],
          new_agents_needed: [],
        },
      }),
    })

    render(<WorkflowCreator />)
    await user.type(screen.getByPlaceholderText(/Check system health/i), 'critical task')
    await user.click(screen.getByRole('button', { name: /Generate Plan/i }))

    await waitFor(() => screen.getByText('Review & Approve Plan'))
    expect(screen.getByText('Human Approval Required')).toBeInTheDocument()
  })

  it('"Cancel & Edit Task" button clears the plan and returns to input view', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: {
          workflow_name: 'Test Plan',
          reasoning: 'Testing cancel',
          estimated_duration_minutes: 1,
          estimated_cost: 0,
          steps: [{ step_number: 1, agent: 'a', description: 'A', parameters: {}, requires_approval: false }],
          new_agents_needed: [],
        },
      }),
    })

    render(<WorkflowCreator />)
    await user.type(screen.getByPlaceholderText(/Check system health/i), 'test')
    await user.click(screen.getByRole('button', { name: /Generate Plan/i }))
    await waitFor(() => screen.getByText('Review & Approve Plan'))

    await user.click(screen.getByRole('button', { name: /Cancel & Edit Task/i }))
    expect(screen.getByText('Generate Plan')).toBeInTheDocument()
    expect(screen.queryByText('Review & Approve Plan')).not.toBeInTheDocument()
  })

  it('POSTs to /api/ceo/plan with the user prompt', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        plan: {
          workflow_name: 'W',
          reasoning: 'R',
          estimated_duration_minutes: 1,
          estimated_cost: 0,
          steps: [{ step_number: 1, agent: 'a', description: 'A', parameters: {}, requires_approval: false }],
          new_agents_needed: [],
        },
      }),
    })

    render(<WorkflowCreator />)
    await user.type(screen.getByPlaceholderText(/Check system health/i), 'hello task')
    await user.click(screen.getByRole('button', { name: /Generate Plan/i }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce())
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/ceo/plan')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.userPrompt).toContain('hello task')
  })

  describe('test mode', () => {
    it('shows Test & Constraint Options toggle button', () => {
      render(<WorkflowCreator />)
      expect(screen.getByText('Test & Constraint Options')).toBeInTheDocument()
    })

    it('expands advanced options panel on click', async () => {
      const user = userEvent.setup()
      render(<WorkflowCreator />)
      await user.click(screen.getByText('Test & Constraint Options'))
      expect(screen.getByText(/Test \/ Dry Run Mode/i)).toBeInTheDocument()
    })

    it('activates test mode via toggle and shows badge', async () => {
      const user = userEvent.setup()
      render(<WorkflowCreator />)
      await user.click(screen.getByText('Test & Constraint Options'))
      // Click the toggle button (role="button" near the Test Mode label)
      const toggleButtons = screen.getAllByRole('button')
      const testModeToggle = toggleButtons.find(btn =>
        btn.className.includes('rounded-full') && btn.className.includes('h-6')
      )
      await user.click(testModeToggle)
      expect(screen.getByText('Generate Test Plan')).toBeInTheDocument()
    })

    it('appends test mode constraints to the prompt sent to API', async () => {
      const user = userEvent.setup()
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          plan: {
            workflow_name: 'W',
            reasoning: 'R',
            estimated_duration_minutes: 1,
            estimated_cost: 0,
            steps: [{ step_number: 1, agent: 'a', description: 'A', parameters: {}, requires_approval: false }],
            new_agents_needed: [],
          },
        }),
      })

      render(<WorkflowCreator />)
      await user.type(screen.getByPlaceholderText(/Check system health/i), 'my task')
      await user.click(screen.getByText('Test & Constraint Options'))
      const toggleButtons = screen.getAllByRole('button')
      const testModeToggle = toggleButtons.find(btn =>
        btn.className.includes('rounded-full') && btn.className.includes('h-6')
      )
      await user.click(testModeToggle)
      await user.click(screen.getByRole('button', { name: /Generate Test Plan/i }))

      await waitFor(() => expect(mockFetch).toHaveBeenCalledOnce())
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.userPrompt).toContain('TEST / DRY RUN')
    })
  })

  describe('save workflow', () => {
    it('calls /api/ceo/save and shows success callout', async () => {
      const user = userEvent.setup()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            plan: {
              workflow_name: 'Save Me',
              reasoning: 'R',
              estimated_duration_minutes: 1,
              estimated_cost: 0,
              steps: [{ step_number: 1, agent: 'a', description: 'A', parameters: {}, requires_approval: false }],
              new_agents_needed: [],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ workflowId: 'abcd1234-save-workflow' }),
        })

      render(<WorkflowCreator />)
      await user.type(screen.getByPlaceholderText(/Check system health/i), 'save this')
      await user.click(screen.getByRole('button', { name: /Generate Plan/i }))
      await waitFor(() => screen.getByText('Review & Approve Plan'))

      await user.click(screen.getByRole('button', { name: /Approve & Save/i }))
      await waitFor(() => {
        // workflowId.substring(0, 8) = 'abcd1234'
        expect(screen.getByText(/abcd1234/i)).toBeInTheDocument()
      })
      const saveCall = mockFetch.mock.calls[1]
      expect(saveCall[0]).toBe('/api/ceo/save')
    })
  })

  describe('execute workflow', () => {
    it('calls /api/ceo/execute and shows success callout', async () => {
      const user = userEvent.setup()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            plan: {
              workflow_name: 'Execute Me',
              reasoning: 'R',
              estimated_duration_minutes: 1,
              estimated_cost: 0,
              steps: [{ step_number: 1, agent: 'a', description: 'A', parameters: {}, requires_approval: false }],
              new_agents_needed: [],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ workflowId: 'exec1234-exec-workflow' }),
        })

      render(<WorkflowCreator />)
      await user.type(screen.getByPlaceholderText(/Check system health/i), 'execute this')
      await user.click(screen.getByRole('button', { name: /Generate Plan/i }))
      await waitFor(() => screen.getByText('Review & Approve Plan'))

      await user.click(screen.getByRole('button', { name: /Approve & Execute/i }))
      await waitFor(() => {
        // workflowId.substring(0, 8) = 'exec1234'
        expect(screen.getByText(/exec1234/i)).toBeInTheDocument()
      })
      const execCall = mockFetch.mock.calls[1]
      expect(execCall[0]).toBe('/api/ceo/execute')
    })
  })
})
