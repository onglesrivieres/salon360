/*
  # Block skip_queue_on_checkin Technicians from Joining Queue

  ## Overview
  Prevents employees with skip_queue_on_checkin = true from manually joining
  the ready queue via the Ready button. Adds a server-side guard to the
  join_ready_queue_with_checkin RPC function.

  ## Changes

  ### Functions
  - `join_ready_queue_with_checkin` - Added SKIP_QUEUE_ENABLED check after cooldown check

  ## Notes
  - Ticket completion flows are unaffected (they only operate on existing queue entries)
  - Frontend also blocks the action, but this provides a server-side safety net
*/

-- ============================================================================
-- FUNCTION: join_ready_queue_with_checkin (updated with skip_queue guard)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.join_ready_queue_with_checkin(p_employee_id uuid, p_store_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attendance record; v_today date; v_all_completed boolean; v_ticket_id uuid;
  v_position integer; v_total integer; v_ready_at timestamptz;
  v_cooldown_record record; v_minutes_remaining integer;
BEGIN
  v_today := CURRENT_DATE;

  -- Check cooldown
  SELECT qrl.cooldown_expires_at, qrl.reason, qrl.notes, e.display_name as removed_by_name,
         EXTRACT(EPOCH FROM (qrl.cooldown_expires_at - now())) / 60 as minutes_remaining
  INTO v_cooldown_record
  FROM public.queue_removals_log qrl JOIN public.employees e ON e.id = qrl.removed_by_employee_id
  WHERE qrl.employee_id = p_employee_id AND qrl.store_id = p_store_id AND qrl.cooldown_expires_at > now()
  ORDER BY qrl.removed_at DESC LIMIT 1;

  IF v_cooldown_record IS NOT NULL THEN
    v_minutes_remaining := CEIL(v_cooldown_record.minutes_remaining);
    RETURN json_build_object('success', false, 'error', 'COOLDOWN_ACTIVE',
      'message', format('Cannot join queue for %s more minutes. Removed for: %s', v_minutes_remaining, v_cooldown_record.reason),
      'cooldown_expires_at', v_cooldown_record.cooldown_expires_at, 'minutes_remaining', v_minutes_remaining, 'position', 0, 'total', 0);
  END IF;

  -- Check if employee has skip_queue_on_checkin enabled
  IF EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = p_employee_id AND skip_queue_on_checkin = true
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'SKIP_QUEUE_ENABLED',
      'message', 'This employee is configured to check in without the queue',
      'position', 0, 'total', 0
    );
  END IF;

  -- Check attendance
  SELECT * INTO v_attendance FROM public.attendance_records
  WHERE employee_id = p_employee_id AND store_id = p_store_id AND work_date = v_today AND status = 'checked_in'
  ORDER BY check_in_time DESC LIMIT 1;

  IF v_attendance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'CHECK_IN_REQUIRED', 'message', 'Must check in before joining queue', 'position', 0, 'total', 0);
  END IF;

  -- Mark services as completed
  UPDATE public.ticket_items ti SET completed_at = NOW(), completed_by = p_employee_id, updated_at = NOW()
  WHERE ti.employee_id = p_employee_id AND ti.completed_at IS NULL
    AND EXISTS (SELECT 1 FROM public.sale_tickets st WHERE st.id = ti.sale_ticket_id AND st.store_id = p_store_id AND st.closed_at IS NULL);

  -- Check if tickets should be marked completed
  FOR v_ticket_id IN (SELECT DISTINCT ti.sale_ticket_id FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = p_employee_id AND st.store_id = p_store_id AND st.closed_at IS NULL AND st.completed_at IS NULL)
  LOOP
    v_all_completed := public.check_ticket_all_services_completed(v_ticket_id);
    IF v_all_completed THEN
      UPDATE public.sale_tickets SET completed_at = NOW(), completed_by = p_employee_id, updated_at = NOW()
      WHERE id = v_ticket_id AND completed_at IS NULL;
    END IF;
  END LOOP;

  -- Remove existing entry and add new
  DELETE FROM public.technician_ready_queue WHERE employee_id = p_employee_id AND store_id = p_store_id;
  INSERT INTO public.technician_ready_queue (employee_id, store_id, status, ready_at)
  VALUES (p_employee_id, p_store_id, 'ready', NOW()) RETURNING ready_at INTO v_ready_at;

  -- Calculate position
  SELECT COUNT(*) + 1 INTO v_position FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready' AND ready_at < v_ready_at;
  SELECT COUNT(*) INTO v_total FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready';

  RETURN json_build_object('success', true, 'position', v_position, 'total', v_total);
END;
$$;
