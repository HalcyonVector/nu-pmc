-- payment-batch-relay.sql
-- Updates signoff_workflows row for payment_batch to use
-- the 3-step relay: PMC Head → Principal → Finance.
--
-- The previous sequence 'finance,naveen' used an unregistered role token
-- ('naveen') that would fail at runtime. This replaces it with role tokens
-- that have registered APPROVER_RESOLVERS in signoff-gate.js.
--
-- Run on EC2 after deploying the code changes.

UPDATE signoff_workflows
SET
  sequence              = 'pmc,principal,finance',
  quorum_required       = 3,
  closing_minutes       = NULL,
  destination_kind      = 'project',
  destination_qualifier = 'finance'
WHERE workflow_type = 'payment_batch';

-- Verify
SELECT workflow_type, sequence, quorum_required, closing_minutes,
       destination_kind, destination_qualifier
  FROM signoff_workflows
 WHERE workflow_type = 'payment_batch';
