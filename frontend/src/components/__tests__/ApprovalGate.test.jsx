import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ApprovalGate from '../ApprovalGate.jsx'

const baseApproval = {
  id: 'approval-uuid-1',
  workflow_id: 'workflow-uuid-1',
  approval_type: 'pre_execution',
  prompt: 'Please approve this step before proceeding.',
  context: {},
  step_order: 2,
  created_at: '2026-02-26T12:00:00Z',
}

describe('ApprovalGate', () => {
  let onApprove, onReject, onClose

  beforeEach(() => {
    onApprove = vi.fn().mockResolvedValue(undefined)
    onReject = vi.fn().mockResolvedValue(undefined)
    onClose = vi.fn()
  })

  it('renders the modal overlay', () => {
    render(<ApprovalGate approval={baseApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
    expect(screen.getByText('Pre-Execution Approval')).toBeInTheDocument()
  })

  it('displays the approval prompt', () => {
    render(<ApprovalGate approval={baseApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
    expect(screen.getByText('Please approve this step before proceeding.')).toBeInTheDocument()
  })

  it('shows Approve & Continue and Reject buttons', () => {
    render(<ApprovalGate approval={baseApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
    expect(screen.getByText('Approve & Continue')).toBeInTheDocument()
    expect(screen.getByText('Reject')).toBeInTheDocument()
  })

  it('calls onApprove with notes when Approve button clicked', async () => {
    const user = userEvent.setup()
    render(<ApprovalGate approval={baseApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText(/Add any notes/)
    await user.type(textarea, 'Looks good')
    await user.click(screen.getByText('Approve & Continue'))
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith('Looks good'))
  })

  it('calls onReject with notes when Reject button clicked', async () => {
    const user = userEvent.setup()
    render(<ApprovalGate approval={baseApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText(/Add any notes/)
    await user.type(textarea, 'Not ready')
    await user.click(screen.getByText('Reject'))
    await waitFor(() => expect(onReject).toHaveBeenCalledWith('Not ready'))
  })

  it('calls onApprove with empty string when no notes entered', async () => {
    const user = userEvent.setup()
    render(<ApprovalGate approval={baseApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
    await user.click(screen.getByText('Approve & Continue'))
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith(''))
  })

  it('displays the approval ID and workflow ID in metadata', () => {
    render(<ApprovalGate approval={baseApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
    expect(screen.getByText(/approval-uuid-1/i)).toBeInTheDocument()
    expect(screen.getByText(/workflow-uuid-1/i)).toBeInTheDocument()
  })

  it('shows the step number in metadata', () => {
    render(<ApprovalGate approval={baseApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
    expect(screen.getByText(/Step 2/)).toBeInTheDocument()
  })

  describe('approval types', () => {
    it('renders Post-Validation Approval for post_validation type', () => {
      render(
        <ApprovalGate
          approval={{ ...baseApproval, approval_type: 'post_validation' }}
          onApprove={onApprove} onReject={onReject} onClose={onClose}
        />
      )
      expect(screen.getByText('Post-Validation Approval')).toBeInTheDocument()
    })

    it('renders Critical Action Approval for critical_action type', () => {
      render(
        <ApprovalGate
          approval={{ ...baseApproval, approval_type: 'critical_action' }}
          onApprove={onApprove} onReject={onReject} onClose={onClose}
        />
      )
      expect(screen.getByText('Critical Action Approval')).toBeInTheDocument()
    })

    it('renders Agent Creation Approval for agent_creation type', () => {
      render(
        <ApprovalGate
          approval={{ ...baseApproval, approval_type: 'agent_creation' }}
          onApprove={onApprove} onReject={onReject} onClose={onClose}
        />
      )
      expect(screen.getByText('Agent Creation Approval')).toBeInTheDocument()
    })

    it('falls back to pre_execution for unknown type', () => {
      render(
        <ApprovalGate
          approval={{ ...baseApproval, approval_type: 'unknown_type' }}
          onApprove={onApprove} onReject={onReject} onClose={onClose}
        />
      )
      expect(screen.getByText('Pre-Execution Approval')).toBeInTheDocument()
    })
  })

  describe('agent_creation approval', () => {
    const agentApproval = {
      ...baseApproval,
      approval_type: 'agent_creation',
      context: {
        agent_name: 'data-cleaner',
        description: 'Cleans and normalizes data files',
        capabilities: ['csv-parsing', 'deduplication'],
        code_preview: 'import pandas as pd\n# ...',
        validation_status: 'safe',
      },
    }

    it('shows agent name when provided', () => {
      render(<ApprovalGate approval={agentApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
      expect(screen.getByText(/New Agent: data-cleaner/)).toBeInTheDocument()
    })

    it('shows capabilities badges', () => {
      render(<ApprovalGate approval={agentApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
      expect(screen.getByText('csv-parsing')).toBeInTheDocument()
      expect(screen.getByText('deduplication')).toBeInTheDocument()
    })

    it('shows code preview', () => {
      render(<ApprovalGate approval={agentApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
      expect(screen.getByText(/import pandas as pd/)).toBeInTheDocument()
    })

    it('shows safety check passed callout when validation_status is safe', () => {
      render(<ApprovalGate approval={agentApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
      expect(screen.getByText('Safety Check Passed')).toBeInTheDocument()
    })

    it('shows safety check warning when validation_status is not safe', () => {
      const unsafeApproval = {
        ...agentApproval,
        context: { ...agentApproval.context, validation_status: 'unsafe' },
      }
      render(<ApprovalGate approval={unsafeApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
      expect(screen.getByText('Safety Check Warning')).toBeInTheDocument()
    })

    it('toggles between code preview and full code', async () => {
      const user = userEvent.setup()
      const fullCodeApproval = {
        ...agentApproval,
        context: { ...agentApproval.context, full_code: 'FULL CODE HERE' },
      }
      render(<ApprovalGate approval={fullCodeApproval} onApprove={onApprove} onReject={onReject} onClose={onClose} />)
      const toggleBtn = screen.getByText('Show Full Code')
      await user.click(toggleBtn)
      expect(screen.getByText(/FULL CODE HERE/)).toBeInTheDocument()
      expect(screen.getByText('Show Less')).toBeInTheDocument()
    })
  })
})
