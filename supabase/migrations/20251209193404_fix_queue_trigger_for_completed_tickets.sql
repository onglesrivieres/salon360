/*
  # Fix Queue Trigger for Completed Tickets

  ## Problem
  The `sale_tickets_mark_available` trigger only watches for `closed_at` updates, but the system
  uses `completed_at` to mark when services are done. This causes technicians to remain stuck in
  the queue after completing their work, preventing them from appearing as available.

  ## Solution
  Update the trigger to fire on BOTH `completed_at` AND `closed_at` updates, ensuring technicians
  are properly released from the queue whenever their work is done.

  ## Changes
  1. Update trigger definition to watch both `completed_at` and `closed_at` fields
  2. Update trigger function to handle both completion and closure scenarios
  3. Clean up orphaned queue entries where tickets are completed but technicians still in queue

  ## Business Impact
  - Technicians will be automatically removed from queue when tickets are marked completed
  - Technicians can immediately rejoin the ready queue after completing their work
  - Queue will accurately reflect available technicians in real-time
*/

-- ============================================================================
-- UPDATE trigger_mark_technicians_available FUNCTION
-- ============================================================================
-- This function now handles both ticket completion and closure

CREATE OR REPLACE FUNCTION public.trigger_mark_technicians_available()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Process if ticket was just completed OR closed
  -- completed_at: when all services are done (technician clicks "Ready")
  -- closed_at: when payment is processed and ticket is fully closed

  IF (OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL) OR
     (OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL) THEN

    -- Remove all technicians who worked on this ticket from the queue
    -- This allows them to appear as available and join the ready queue again
    DELETE FROM public.technician_ready_queue
    WHERE employee_id IN (
      SELECT employee_id
      FROM public.ticket_items
      WHERE sale_ticket_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.trigger_mark_technicians_available() SET search_path = '';

COMMENT ON FUNCTION public.trigger_mark_technicians_available IS
'Removes technicians from queue when ticket is completed or closed. Watches both completed_at and closed_at fields.';

-- ============================================================================
-- UPDATE TRIGGER DEFINITION
-- ============================================================================
-- Drop existing trigger and recreate to watch both fields

DROP TRIGGER IF EXISTS sale_tickets_mark_available ON sale_tickets;

CREATE TRIGGER sale_tickets_mark_available
  AFTER UPDATE OF completed_at, closed_at ON sale_tickets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_mark_technicians_available();

COMMENT ON TRIGGER sale_tickets_mark_available ON sale_tickets IS
'Fires when ticket is completed or closed to release technicians from queue';

-- ============================================================================
-- CLEANUP ORPHANED QUEUE ENTRIES
-- ============================================================================
-- Remove technicians from queue who are stuck with completed tickets

DO $$
DECLARE
  v_cleaned_count int;
BEGIN
  -- Find and remove technicians in queue who have completed tickets
  WITH completed_ticket_technicians AS (
    SELECT DISTINCT ti.employee_id
    FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE st.completed_at IS NOT NULL  -- Ticket is completed
      AND st.closed_at IS NULL         -- But not yet closed
      AND ti.employee_id IN (
        SELECT employee_id
        FROM public.technician_ready_queue
        WHERE status = 'busy'
      )
  )
  DELETE FROM public.technician_ready_queue
  WHERE employee_id IN (SELECT employee_id FROM completed_ticket_technicians);

  GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % orphaned queue entries with completed tickets', v_cleaned_count;
END $$;
