-- Fix foreign key constraint on workflow_approvals to CASCADE on delete
-- This allows workflows to be deleted even if they have approval records

-- Drop existing constraint
ALTER TABLE workflow_approvals
  DROP CONSTRAINT IF EXISTS workflow_approvals_workflow_id_fkey;

-- Add new constraint with CASCADE
ALTER TABLE workflow_approvals
  ADD CONSTRAINT workflow_approvals_workflow_id_fkey
  FOREIGN KEY (workflow_id)
  REFERENCES agent_workflows(id)
  ON DELETE CASCADE;

-- Verify the fix
SELECT
  conname AS constraint_name,
  confdeltype AS on_delete_action
FROM pg_constraint
WHERE conname = 'workflow_approvals_workflow_id_fkey';

-- Expected output: on_delete_action should be 'c' (CASCADE)
