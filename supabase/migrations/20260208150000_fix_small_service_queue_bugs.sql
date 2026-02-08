-- Migration: Fix small service queue bugs
--
-- Bug 1: mark_technician_busy_smart() required technician to be LAST in ready queue
--         for small_service status. In practice, the FIRST person gets the next service,
--         so the is_last condition was almost never true. Fix: remove is_last_in_ready_queue check.
--
-- Bug 2: trigger_mark_technicians_available() was regressed to a blanket DELETE from queue
--         on ticket completion, instead of calling handle_ticket_close_smart() which correctly
--         returns small_service technicians to ready status. Fix: call handle_ticket_close_smart().

-- ============================================================================
-- FIX 1: trigger_mark_technicians_available - use handle_ticket_close_smart
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_mark_technicians_available()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    PERFORM public.handle_ticket_close_smart(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- FIX 2: mark_technician_busy_smart - remove is_last_in_ready_queue gate
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_technician_busy_smart(p_employee_id uuid, p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_store_id uuid; v_threshold numeric; v_ticket_total numeric; v_current_status text; v_new_status text; v_small_service_enabled boolean;
BEGIN
  SELECT store_id INTO v_store_id FROM public.sale_tickets WHERE id = p_ticket_id;
  IF v_store_id IS NULL THEN RETURN; END IF;

  SELECT status INTO v_current_status FROM public.technician_ready_queue WHERE employee_id = p_employee_id AND store_id = v_store_id;
  IF v_current_status IS NULL THEN RETURN; END IF;
  IF v_current_status = 'busy' THEN
    UPDATE public.technician_ready_queue SET current_open_ticket_id = p_ticket_id, updated_at = now() WHERE employee_id = p_employee_id AND store_id = v_store_id;
    RETURN;
  END IF;

  -- Check if small service feature is enabled for this store
  SELECT COALESCE((setting_value)::boolean, true) INTO v_small_service_enabled
  FROM public.app_settings WHERE store_id = v_store_id AND setting_key = 'enable_small_service';
  IF v_small_service_enabled IS NULL THEN v_small_service_enabled := true; END IF;

  IF NOT v_small_service_enabled THEN
    -- Small service disabled: always go to busy
    UPDATE public.technician_ready_queue SET status = 'busy', current_open_ticket_id = p_ticket_id, updated_at = now()
    WHERE employee_id = p_employee_id AND store_id = v_store_id;
    RETURN;
  END IF;

  v_ticket_total := public.calculate_ticket_total(p_ticket_id);
  v_threshold := public.get_small_service_threshold(v_store_id);

  IF v_ticket_total < v_threshold THEN v_new_status := 'small_service'; ELSE v_new_status := 'busy'; END IF;
  IF v_current_status = 'small_service' AND v_ticket_total >= v_threshold THEN v_new_status := 'busy'; END IF;

  UPDATE public.technician_ready_queue SET status = v_new_status, current_open_ticket_id = p_ticket_id, updated_at = now()
  WHERE employee_id = p_employee_id AND store_id = v_store_id;
END;
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
