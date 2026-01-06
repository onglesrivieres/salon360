/*
  # Fix join_ready_queue_with_checkin Column Reference

  ## Problem
  The function references `e.name` in the cooldown check query, but the employees
  table uses `display_name` instead of `name`. This causes a "column e.name does
  not exist" error when trying to join the queue.

  ## Solution
  Change `e.name` to `e.display_name` in the cooldown check query.

  ## Impact
  - Fixes the "column e.name does not exist" error
  - Allows employees to successfully join the ready queue
*/

CREATE OR REPLACE FUNCTION public.join_ready_queue_with_checkin(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendance record;
  v_today date;
  v_store_timezone text;
  v_all_completed boolean;
  v_ticket_id uuid;
  v_position integer;
  v_total integer;
  v_ready_at timestamptz;
  v_cooldown_record record;
  v_minutes_remaining integer;
  v_removed_by_name text;
BEGIN
  -- Get store timezone and calculate today's date in that timezone
  -- This ensures consistency with check_in_employee which uses the same method
  v_store_timezone := public.get_store_timezone(p_store_id);
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::date;

  -- Check for active cooldown
  SELECT
    qrl.cooldown_expires_at,
    qrl.reason,
    qrl.notes,
    e.display_name as removed_by_name,  -- Fixed: was e.name
    EXTRACT(EPOCH FROM (qrl.cooldown_expires_at - now())) / 60 as minutes_remaining
  INTO v_cooldown_record
  FROM public.queue_removals_log qrl
  JOIN public.employees e ON e.id = qrl.removed_by_employee_id
  WHERE qrl.employee_id = p_employee_id
    AND qrl.store_id = p_store_id
    AND qrl.cooldown_expires_at > now()
  ORDER BY qrl.removed_at DESC
  LIMIT 1;

  IF v_cooldown_record IS NOT NULL THEN
    v_minutes_remaining := CEIL(v_cooldown_record.minutes_remaining);

    RETURN json_build_object(
      'success', false,
      'error', 'COOLDOWN_ACTIVE',
      'message', format(
        'You cannot join the queue for %s more minutes. You were removed for: %s',
        v_minutes_remaining,
        v_cooldown_record.reason
      ),
      'cooldown_expires_at', v_cooldown_record.cooldown_expires_at,
      'minutes_remaining', v_minutes_remaining,
      'reason', v_cooldown_record.reason,
      'notes', v_cooldown_record.notes,
      'removed_by_name', v_cooldown_record.removed_by_name,
      'position', 0,
      'total', 0
    );
  END IF;

  -- Check if employee is checked in
  SELECT *
  INTO v_attendance
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = v_today
    AND status = 'checked_in'
  ORDER BY check_in_time DESC
  LIMIT 1;

  IF v_attendance IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CHECK_IN_REQUIRED',
      'message', 'You must check in before joining the ready queue',
      'position', 0,
      'total', 0
    );
  END IF;

  -- Mark individual services (ticket_items) assigned to this technician as completed
  UPDATE public.ticket_items ti
  SET
    completed_at = NOW(),
    completed_by = p_employee_id,
    updated_at = NOW()
  WHERE ti.employee_id = p_employee_id
    AND ti.completed_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.sale_tickets st
      WHERE st.id = ti.sale_ticket_id
        AND st.store_id = p_store_id
        AND st.closed_at IS NULL
    );

  -- For each affected ticket, check if ALL services are now completed
  FOR v_ticket_id IN (
    SELECT DISTINCT ti.sale_ticket_id
    FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = p_employee_id
      AND st.store_id = p_store_id
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
  )
  LOOP
    v_all_completed := public.check_ticket_all_services_completed(v_ticket_id);

    IF v_all_completed THEN
      -- Mark ticket as completed but keep it open
      UPDATE public.sale_tickets
      SET
        completed_at = NOW(),
        completed_by = p_employee_id,
        updated_at = NOW()
      WHERE id = v_ticket_id
        AND completed_at IS NULL;
    END IF;
  END LOOP;

  -- Remove any existing entry for this technician in this store
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id;

  -- Add technician to ready queue
  INSERT INTO public.technician_ready_queue (
    employee_id,
    store_id,
    status,
    ready_at
  ) VALUES (
    p_employee_id,
    p_store_id,
    'ready',
    NOW()
  )
  RETURNING ready_at INTO v_ready_at;

  -- Calculate position (count how many people joined before this employee)
  SELECT COUNT(*) + 1
  INTO v_position
  FROM public.technician_ready_queue
  WHERE store_id = p_store_id
    AND status = 'ready'
    AND ready_at < v_ready_at;

  -- Get total count of ready employees in this store
  SELECT COUNT(*)
  INTO v_total
  FROM public.technician_ready_queue
  WHERE store_id = p_store_id
    AND status = 'ready';

  RETURN json_build_object(
    'success', true,
    'position', v_position,
    'total', v_total
  );
END;
$$;

COMMENT ON FUNCTION public.join_ready_queue_with_checkin IS 'Adds employee to ready queue with attendance validation and cooldown check. Uses store timezone for date calculations. Returns position and total queue size. Fixed column reference from e.name to e.display_name.';
