/*
  # Update Queue Triggers for Small Service

  ## Overview
  Updates the trigger functions to use the smart functions that support
  the small service feature.

  ## Changes
  1. trigger_mark_technician_busy - Uses mark_technician_busy_smart
  2. trigger_mark_technician_busy_on_update - Uses mark_technician_busy_smart
  3. trigger_mark_technicians_available - Uses handle_ticket_close_smart

  ## Behavior
  - INSERT/UPDATE on ticket_items: Calls mark_technician_busy_smart to determine status
  - UPDATE on sale_tickets (close): Calls handle_ticket_close_smart to handle differently
    based on whether technician was small_service or busy
*/

-- Update the INSERT trigger function to use smart function
CREATE OR REPLACE FUNCTION public.trigger_mark_technician_busy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket_closed_at timestamptz;
BEGIN
  -- Check if the ticket is still open
  SELECT closed_at INTO v_ticket_closed_at
  FROM public.sale_tickets
  WHERE id = NEW.sale_ticket_id;

  -- Only mark as busy if ticket is still open
  IF v_ticket_closed_at IS NULL THEN
    PERFORM public.mark_technician_busy_smart(NEW.employee_id, NEW.sale_ticket_id);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_mark_technician_busy() IS
'Trigger function to mark technician busy (or small_service) when assigned to a ticket item. Uses smart function to determine status based on ticket total and queue position.';

-- Update the UPDATE trigger function to use smart function
CREATE OR REPLACE FUNCTION public.trigger_mark_technician_busy_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket_completed_at timestamptz;
BEGIN
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id AND NEW.employee_id IS NOT NULL THEN
    SELECT completed_at INTO v_ticket_completed_at
    FROM public.sale_tickets
    WHERE id = NEW.sale_ticket_id;

    IF v_ticket_completed_at IS NULL THEN
      PERFORM public.mark_technician_busy_smart(NEW.employee_id, NEW.sale_ticket_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_mark_technician_busy_on_update() IS
'Trigger function to mark technician busy (or small_service) when reassigned to a ticket item via UPDATE. Uses smart function to determine status.';

-- Update the ticket close trigger function to use smart function
CREATE OR REPLACE FUNCTION public.trigger_mark_technicians_available()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL THEN
    PERFORM public.handle_ticket_close_smart(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_mark_technicians_available() IS
'Trigger function to handle technician availability when ticket closes. Small_service technicians return to ready status (keeping position). Busy technicians are removed from queue.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
