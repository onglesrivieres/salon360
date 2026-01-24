/*
  # Fix Queue Functions Schema Qualification

  1. Overview
     - Adds explicit schema qualifications (public.) to all table references
     - Fixes the "relation does not exist" errors in queue functions
     - Makes functions compatible with empty search_path security setting

  2. Functions Fixed
     - check_queue_status()
     - leave_ready_queue()
     - join_ready_queue()
     - join_ready_queue_with_checkin()

  3. Security
     - Maintains security by working with empty search_path
     - Prevents search_path manipulation attacks
*/

-- ============================================================================
-- FIX check_queue_status FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_queue_status(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_in_queue boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 
    FROM public.technician_ready_queue
    WHERE employee_id = p_employee_id
      AND store_id = p_store_id
      AND status = 'ready'
  ) INTO v_in_queue;
  
  RETURN v_in_queue;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.check_queue_status(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- ============================================================================
-- FIX leave_ready_queue FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.leave_ready_queue(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove employee from ready queue
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.leave_ready_queue(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- ============================================================================
-- FIX join_ready_queue FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.join_ready_queue(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Mark any open tickets assigned to this technician as completed
  UPDATE public.sale_tickets
  SET
    completed_at = NOW(),
    completed_by = p_employee_id,
    updated_at = NOW()
  WHERE id IN (
    SELECT DISTINCT ti.sale_ticket_id
    FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = p_employee_id
      AND st.store_id = p_store_id
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
  );

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
  );
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.join_ready_queue(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- ============================================================================
-- FIX join_ready_queue_with_checkin FUNCTION
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
      'message', 'You must check in before joining the ready queue'
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
  );

  RETURN json_build_object('success', true);
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.join_ready_queue_with_checkin(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- Add comments
COMMENT ON FUNCTION public.check_queue_status IS 'Checks if employee is in ready queue. All tables fully qualified for security.';
COMMENT ON FUNCTION public.leave_ready_queue IS 'Removes employee from ready queue. All tables fully qualified for security.';
COMMENT ON FUNCTION public.join_ready_queue IS 'Adds employee to ready queue and completes their tickets. All tables fully qualified for security.';
COMMENT ON FUNCTION public.join_ready_queue_with_checkin IS 'Adds employee to ready queue with attendance validation. All tables fully qualified for security.';
