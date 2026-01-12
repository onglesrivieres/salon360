/*
  # Add Small Service Helper Functions

  ## Overview
  Creates helper functions for the smart turn division feature:
  - get_small_service_threshold: Get threshold for a store
  - is_last_in_ready_queue: Check if technician is last in queue
  - calculate_ticket_total: Calculate total from ticket items
  - mark_technician_busy_smart: Smart function with small service logic
  - handle_ticket_close_smart: Preserve position for small_service on close

  ## Logic
  - If service total < threshold AND technician is last in queue: small_service status
  - If service total >= threshold OR not last: busy status
  - On ticket close: small_service returns to ready, busy is removed from queue
*/

-- Function to get small service threshold for a store
CREATE OR REPLACE FUNCTION public.get_small_service_threshold(p_store_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_threshold numeric;
BEGIN
  SELECT (setting_value)::numeric INTO v_threshold
  FROM public.app_settings
  WHERE store_id = p_store_id AND setting_key = 'small_service_threshold';

  RETURN COALESCE(v_threshold, 30);
END;
$$;

COMMENT ON FUNCTION public.get_small_service_threshold(uuid) IS
'Returns the small service threshold for a store. Defaults to 30 if not configured.';

-- Function to check if technician is last in ready queue
CREATE OR REPLACE FUNCTION public.is_last_in_ready_queue(p_employee_id uuid, p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_position integer;
  v_tech_position integer;
BEGIN
  -- Get the maximum position (last person) among READY technicians only
  SELECT COUNT(*) INTO v_max_position
  FROM public.technician_ready_queue
  WHERE store_id = p_store_id AND status = 'ready';

  -- Get this technician's position (if they are ready)
  SELECT pos INTO v_tech_position
  FROM (
    SELECT employee_id, ROW_NUMBER() OVER (ORDER BY ready_at ASC) as pos
    FROM public.technician_ready_queue
    WHERE store_id = p_store_id AND status = 'ready'
  ) q
  WHERE q.employee_id = p_employee_id;

  -- Technician is last if their position equals the max position
  RETURN v_tech_position = v_max_position AND v_max_position IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.is_last_in_ready_queue(uuid, uuid) IS
'Returns true if the technician is the last one in the ready queue (highest position, joined most recently).';

-- Function to calculate ticket total from ticket_items
CREATE OR REPLACE FUNCTION public.calculate_ticket_total(p_ticket_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM((qty * price_each) + COALESCE(addon_price, 0)), 0)
  INTO v_total
  FROM public.ticket_items
  WHERE sale_ticket_id = p_ticket_id;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.calculate_ticket_total(uuid) IS
'Calculates the total amount from all ticket items for a given ticket.';

-- Smart function to mark technician busy with small service logic
-- This is called by the trigger instead of the original mark_technician_busy
CREATE OR REPLACE FUNCTION public.mark_technician_busy_smart(
  p_employee_id uuid,
  p_ticket_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_store_id uuid;
  v_threshold numeric;
  v_ticket_total numeric;
  v_is_last boolean;
  v_current_status text;
  v_new_status text;
BEGIN
  -- Get store_id from ticket
  SELECT store_id INTO v_store_id
  FROM public.sale_tickets
  WHERE id = p_ticket_id;

  IF v_store_id IS NULL THEN
    RETURN; -- Ticket not found
  END IF;

  -- Get current queue status
  SELECT status INTO v_current_status
  FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id AND store_id = v_store_id;

  -- If not in queue, nothing to do
  IF v_current_status IS NULL THEN
    RETURN;
  END IF;

  -- If already busy (not small_service), stay busy
  IF v_current_status = 'busy' THEN
    -- Just update the ticket reference if needed
    UPDATE public.technician_ready_queue
    SET current_open_ticket_id = p_ticket_id, updated_at = now()
    WHERE employee_id = p_employee_id AND store_id = v_store_id;
    RETURN;
  END IF;

  -- Calculate current ticket total (all items)
  v_ticket_total := public.calculate_ticket_total(p_ticket_id);

  -- Get threshold
  v_threshold := public.get_small_service_threshold(v_store_id);

  -- Check if technician is last in queue (only if currently ready)
  IF v_current_status = 'ready' THEN
    v_is_last := public.is_last_in_ready_queue(p_employee_id, v_store_id);
  ELSE
    v_is_last := false;
  END IF;

  -- Determine new status
  IF v_ticket_total < v_threshold AND v_is_last THEN
    v_new_status := 'small_service';
  ELSE
    v_new_status := 'busy';
  END IF;

  -- If currently small_service and total now >= threshold, upgrade to busy
  IF v_current_status = 'small_service' AND v_ticket_total >= v_threshold THEN
    v_new_status := 'busy';
  END IF;

  -- Update queue status
  UPDATE public.technician_ready_queue
  SET
    status = v_new_status,
    current_open_ticket_id = p_ticket_id,
    updated_at = now()
  WHERE employee_id = p_employee_id AND store_id = v_store_id;
END;
$$;

COMMENT ON FUNCTION public.mark_technician_busy_smart(uuid, uuid) IS
'Marks a technician as busy or small_service based on the ticket total and queue position. If total < threshold AND technician is last in queue, sets small_service status (yellow). Otherwise sets busy status (red).';

-- Modified function for ticket close (preserve position for small_service)
CREATE OR REPLACE FUNCTION public.handle_ticket_close_smart(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- For small_service: return to ready status (keep position via ready_at)
  UPDATE public.technician_ready_queue
  SET
    status = 'ready',
    current_open_ticket_id = NULL,
    updated_at = now()
  WHERE current_open_ticket_id = p_ticket_id AND status = 'small_service';

  -- For regular busy: remove from queue entirely
  DELETE FROM public.technician_ready_queue
  WHERE current_open_ticket_id = p_ticket_id AND status = 'busy';
END;
$$;

COMMENT ON FUNCTION public.handle_ticket_close_smart(uuid) IS
'Handles ticket close for smart turn division. Technicians with small_service status return to ready (keeping their position). Technicians with busy status are removed from the queue.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
