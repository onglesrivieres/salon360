/*
  # Add Queue Trigger for Ticket Item Employee Reassignments

  ## Problem
  The existing trigger `trigger_mark_technician_busy` only fires on INSERT to ticket_items.
  When an existing ticket item is reassigned to a different technician via UPDATE,
  the new technician is not removed from the ready queue.

  This causes a bug where:
  1. Technician joins the ready queue
  2. An existing ticket item is reassigned to them via UPDATE
  3. They stay in the ready queue (trigger doesn't fire on UPDATE)
  4. When they click Ready button, they see "Stay/Leave" popup instead of just rejoining

  ## Solution
  Add AFTER UPDATE OF employee_id trigger to also mark technicians as busy
  when they are assigned to existing ticket items.

  ## Changes
  1. Create trigger function `trigger_mark_technician_busy_on_update`
  2. Create trigger on ticket_items for AFTER UPDATE OF employee_id
*/

-- Trigger function: Remove technician from queue when reassigned to a ticket
CREATE OR REPLACE FUNCTION public.trigger_mark_technician_busy_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_completed_at timestamptz;
BEGIN
  -- Only process if employee_id actually changed
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id AND NEW.employee_id IS NOT NULL THEN
    -- Check if the ticket is not yet completed
    SELECT completed_at INTO v_ticket_completed_at
    FROM public.sale_tickets
    WHERE id = NEW.sale_ticket_id;

    -- Only remove from queue if ticket is not yet completed
    IF v_ticket_completed_at IS NULL THEN
      PERFORM public.mark_technician_busy(NEW.employee_id, NEW.sale_ticket_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.trigger_mark_technician_busy_on_update() SET search_path = '';

COMMENT ON FUNCTION public.trigger_mark_technician_busy_on_update IS
'Trigger function to remove technician from queue when reassigned to an incomplete ticket via UPDATE.';

-- Create trigger on ticket_items for employee reassignments
DROP TRIGGER IF EXISTS ticket_items_mark_busy_on_update ON public.ticket_items;
CREATE TRIGGER ticket_items_mark_busy_on_update
  AFTER UPDATE OF employee_id ON public.ticket_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_mark_technician_busy_on_update();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
