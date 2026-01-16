-- Add 'deleted' action to the ticket_activity_log action constraint
ALTER TABLE ticket_activity_log
  DROP CONSTRAINT IF EXISTS ticket_activity_log_action_check;

ALTER TABLE ticket_activity_log
  ADD CONSTRAINT ticket_activity_log_action_check
  CHECK (action IN ('created', 'updated', 'closed', 'reopened', 'approved', 'status_corrected', 'deleted'));

-- Fix: Add ON DELETE CASCADE to approval_status_correction_audit foreign key
-- This allows tickets to be deleted even if they have audit records
ALTER TABLE approval_status_correction_audit
  DROP CONSTRAINT IF EXISTS approval_status_correction_audit_ticket_id_fkey;

ALTER TABLE approval_status_correction_audit
  ADD CONSTRAINT approval_status_correction_audit_ticket_id_fkey
  FOREIGN KEY (ticket_id) REFERENCES sale_tickets(id) ON DELETE CASCADE;

-- Fix: Make trigger function safe when technician_ready_queue doesn't exist
CREATE OR REPLACE FUNCTION handle_ticket_delete_queue_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only delete if technician_ready_queue table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'technician_ready_queue'
  ) THEN
    DELETE FROM technician_ready_queue
    WHERE current_open_ticket_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$$;
