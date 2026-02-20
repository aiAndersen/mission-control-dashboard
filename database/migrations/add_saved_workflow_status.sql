-- Migration: Add 'saved' status to agent_workflows
-- Date: 2026-02-16
-- Purpose: Allow workflows to be saved without immediate execution

-- Drop existing constraint
ALTER TABLE agent_workflows
  DROP CONSTRAINT IF EXISTS agent_workflows_status_check;

-- Add new constraint with 'saved' status
ALTER TABLE agent_workflows
  ADD CONSTRAINT agent_workflows_status_check
  CHECK (status IN ('planning', 'pending_approval', 'saved', 'running', 'completed', 'failed', 'cancelled'));

-- Update any NULL statuses to 'planning'
UPDATE agent_workflows
SET status = 'planning'
WHERE status IS NULL;
