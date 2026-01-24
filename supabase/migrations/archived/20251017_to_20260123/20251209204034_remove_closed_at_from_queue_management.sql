/*
  # Remove closed_at References from Queue Management System

  ## Problem
  The queue management system still has one reference to `closed_at` in the
  `trigger_mark_technician_busy` function. This creates inconsistency because:
  - `trigger_mark_technicians_available` watches `completed_at` to release technicians
  - `trigger_mark_technician_busy` checks `closed_at` to determine if ticket is open

  This inconsistency means queue logic uses different fields for similar purposes.

  ## Business Logic
  - Technicians should be removed from queue when assigned to INCOMPLETE tickets
  - A ticket is incomplete when `completed_at IS NULL`
  - A ticket is complete when `completed_at IS NOT NULL`
  - Payment status (closed_at) is irrelevant for queue management
  - Queue system should operate entirely on service completion status

  ## Solution
  Update `trigger_mark_technician_busy` to check `completed_at` instead of `closed_at`

  ## Changes
  1. Replace `closed_at` check with `completed_at` check
  2. Update variable names for clarity (v_ticket_closed_at -> v_ticket_completed_at)
  3. Update comments to reference completion instead of closure
  4. Ensure full consistency across queue management system

  ## Impact
  - Queue management now operates consistently on `completed_at` field
  - Technicians removed from queue when assigned to incomplete tickets
  - Technicians released from queue when tickets are completed
  - Payment processing (closed_at) completely decoupled from queue management
*/

-- ============================================================================
-- UPDATE trigger_mark_technician_busy FUNCTION
-- ============================================================================
-- Remove technician from queue when assigned to a ticket that's not yet completed

CREATE OR REPLACE FUNCTION public.trigger_mark_technician_busy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_completed_at timestamptz;
BEGIN
  -- Check if the ticket is not yet completed
  SELECT completed_at INTO v_ticket_completed_at
  FROM public.sale_tickets
  WHERE id = NEW.sale_ticket_id;

  -- Only remove from queue if ticket is not yet completed
  -- Once a ticket is completed, technicians should already be released
  IF v_ticket_completed_at IS NULL THEN
    PERFORM public.mark_technician_busy(NEW.employee_id, NEW.sale_ticket_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.trigger_mark_technician_busy() SET search_path = '';

COMMENT ON FUNCTION public.trigger_mark_technician_busy IS
'Trigger function to remove technician from queue when assigned to an incomplete ticket. Checks completed_at (not closed_at) to determine ticket status.';

-- Reload schema to ensure changes are picked up
NOTIFY pgrst, 'reload schema';
