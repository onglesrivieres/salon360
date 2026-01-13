-- Migration: Remove technician from queue when their ticket is deleted
-- When a ticket is deleted, the technician should be removed from the queue entirely
-- (marked as "Not Ready" / neutral) rather than being put back as available

-- Trigger function to remove technician from queue when ticket is deleted
CREATE OR REPLACE FUNCTION handle_ticket_delete_queue_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remove technician from queue when their ticket is deleted
  DELETE FROM technician_ready_queue
  WHERE current_open_ticket_id = OLD.id;

  RETURN OLD;
END;
$$;

-- Create trigger BEFORE delete (so we still have access to OLD.id)
CREATE TRIGGER on_ticket_delete_update_queue
  BEFORE DELETE ON sale_tickets
  FOR EACH ROW
  EXECUTE FUNCTION handle_ticket_delete_queue_update();
