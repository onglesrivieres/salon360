-- Migration: Fix ticket delete to remove technician from queue (not mark as ready)
-- When a ticket is deleted, the technician should be removed from the queue entirely
-- (marked as "Not Ready" / neutral) rather than being put back as available

-- Update the trigger function to DELETE instead of UPDATE
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
