-- Add 'deleted' action to the ticket_activity_log action constraint
ALTER TABLE ticket_activity_log
  DROP CONSTRAINT IF EXISTS ticket_activity_log_action_check;

ALTER TABLE ticket_activity_log
  ADD CONSTRAINT ticket_activity_log_action_check
  CHECK (action IN ('created', 'updated', 'closed', 'reopened', 'approved', 'status_corrected', 'deleted'));
