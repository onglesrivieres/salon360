/*
  # Fix Queue Trigger to Watch ONLY completed_at Field

  ## Problem
  The current trigger incorrectly watches BOTH `completed_at` AND `closed_at` fields, causing
  technicians to be removed from the queue twice and potentially causing display issues in the
  Ticket Editor and Technician Queue popup.

  ## Business Logic
  - When technician clicks "Ready" on a ticket, `completed_at` is set
  - This should IMMEDIATELY remove them from the queue
  - Later, when cashier processes payment, `closed_at` is set
  - The `closed_at` update should NOT trigger queue changes (already done)

  ## Solution
  1. Update trigger to watch ONLY `completed_at` field
  2. Update trigger function to process ONLY completed_at changes
  3. Remove any logic related to closed_at watching
  4. Clean up orphaned queue entries where tickets are completed

  ## Changes
  - Drop existing trigger that watches both fields
  - Create new trigger watching ONLY completed_at
  - Update function to ONLY check completed_at changes
  - Add security with proper search_path
  - Clean up any technicians stuck in queue with completed tickets

  ## Impact
  - Technicians will be removed from queue exactly once when they complete work
  - No redundant trigger fires when tickets are closed for payment
  - Queue display in Ticket Editor shows correct availability
  - Technician Queue popup shows accurate real-time status
*/

-- ============================================================================
-- UPDATE trigger_mark_technicians_available FUNCTION
-- ============================================================================
-- This function now ONLY handles ticket completion (NOT closure)

CREATE OR REPLACE FUNCTION public.trigger_mark_technicians_available()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- ONLY process if ticket was just completed (completed_at changed from NULL to timestamp)
  -- completed_at: when all services are done and technician clicks "Ready"
  -- We do NOT watch closed_at because that happens later during payment processing

  IF (OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL) THEN

    -- Remove all technicians who worked on this ticket from the queue
    -- This allows them to appear as neutral/available and join the ready queue again
    DELETE FROM public.technician_ready_queue
    WHERE employee_id IN (
      SELECT ti.employee_id
      FROM public.ticket_items ti
      WHERE ti.sale_ticket_id = NEW.id
    );

  END IF;

  RETURN NEW;
END;
$$;

-- Set secure search_path
ALTER FUNCTION public.trigger_mark_technicians_available() SET search_path = '';

COMMENT ON FUNCTION public.trigger_mark_technicians_available IS
'Removes technicians from queue when ticket is completed. Watches ONLY completed_at field.';

-- ============================================================================
-- UPDATE TRIGGER DEFINITION
-- ============================================================================
-- Drop existing trigger and recreate to watch ONLY completed_at

DROP TRIGGER IF EXISTS sale_tickets_mark_available ON public.sale_tickets;

CREATE TRIGGER sale_tickets_mark_available
  AFTER UPDATE OF completed_at ON public.sale_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_mark_technicians_available();

COMMENT ON TRIGGER sale_tickets_mark_available ON public.sale_tickets IS
'Fires when ticket is completed (completed_at set) to release technicians from queue. Does NOT watch closed_at.';

-- ============================================================================
-- CLEANUP ORPHANED QUEUE ENTRIES
-- ============================================================================
-- Remove technicians from queue who are stuck with completed tickets

DO $$
DECLARE
  v_cleaned_count int;
BEGIN
  -- Find and remove technicians in queue who have completed tickets
  -- These are orphaned entries that shouldn't exist
  WITH completed_ticket_employees AS (
    SELECT DISTINCT ti.employee_id
    FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE st.completed_at IS NOT NULL  -- Ticket has been completed
      AND ti.employee_id IN (
        SELECT trq.employee_id
        FROM public.technician_ready_queue trq
      )
  )
  DELETE FROM public.technician_ready_queue
  WHERE employee_id IN (SELECT employee_id FROM completed_ticket_employees);

  GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;

  RAISE NOTICE 'Cleaned up % orphaned queue entries with completed tickets', v_cleaned_count;
END $$;

-- Reload schema to ensure changes are picked up
NOTIFY pgrst, 'reload schema';
