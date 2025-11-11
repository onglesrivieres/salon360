/*
  # Enhance Queue Functions with Position Information

  ## Overview
  Enhances queue status and join functions to return position and total queue size information.
  This allows the UI to display messages like "You are position 3 of 8 in the queue".

  ## Changes

  ### check_queue_status Function
  - Changed return type from boolean to JSON object
  - Returns: { in_queue: boolean, position: integer, total: integer }
  - Position is calculated based on ready_at timestamp (earlier = lower position)
  - Total counts all employees with status 'ready' in the store's queue

  ### join_ready_queue_with_checkin Function
  - Enhanced return JSON to include position and total
  - Returns: { success: boolean, position: integer, total: integer, message?: string }
  - Calculates position immediately after inserting into queue

  ## Security
  - Maintains SECURITY DEFINER and empty search_path for security
  - All table references fully qualified with public schema
*/

-- ============================================================================
-- ENHANCE check_queue_status FUNCTION TO RETURN POSITION INFO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_queue_status(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_in_queue boolean;
  v_position integer;
  v_total integer;
  v_ready_at timestamptz;
BEGIN
  -- Check if employee is in queue and get their ready_at time
  SELECT
    EXISTS(
      SELECT 1
      FROM public.technician_ready_queue
      WHERE employee_id = p_employee_id
        AND store_id = p_store_id
        AND status = 'ready'
    ),
    ready_at
  INTO v_in_queue, v_ready_at
  FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND status = 'ready';

  IF v_in_queue THEN
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
  ELSE
    v_position := 0;
    v_total := 0;
  END IF;

  RETURN json_build_object(
    'in_queue', v_in_queue,
    'position', v_position,
    'total', v_total
  );
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.check_queue_status(p_employee_id uuid, p_store_id uuid) SET search_path = '';

COMMENT ON FUNCTION public.check_queue_status IS 'Checks if employee is in ready queue and returns position info. Returns JSON with in_queue, position, and total.';

-- ============================================================================
-- ENHANCE join_ready_queue_with_checkin FUNCTION TO RETURN POSITION INFO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.join_ready_queue_with_checkin(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_attendance record;
  v_today date;
  v_all_completed boolean;
  v_ticket_id uuid;
  v_position integer;
  v_total integer;
  v_ready_at timestamptz;
BEGIN
  v_today := CURRENT_DATE;

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

-- Set search_path to empty for security
ALTER FUNCTION public.join_ready_queue_with_checkin(p_employee_id uuid, p_store_id uuid) SET search_path = '';

COMMENT ON FUNCTION public.join_ready_queue_with_checkin IS 'Adds employee to ready queue with attendance validation. Returns position and total queue size.';
