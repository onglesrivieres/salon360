/*
  # Allow Multi-Store Employees to Join Queue at Any Store

  1. Problem
     - Multi-store employees checked in at Store A cannot join queue at Store B
     - The join_ready_queue_with_checkin function only checks attendance at the specific store
     - This prevents employees from being available at multiple locations
     
  2. Solution
     - Update join_ready_queue_with_checkin to check if employee is checked in at ANY store today
     - If they're checked in anywhere, allow them to join the queue at any store they have access to
     - This matches the real-world scenario where employees work across multiple locations
     
  3. Changes
     - Modified attendance validation logic to check ANY store, not just the target store
     - Added schema qualification to fix "relation does not exist" errors
     - Maintains security by still requiring check-in verification
     
  4. Impact
     - Multi-store employees can now join ready queue at any location
     - Busy employees at one store can make themselves available at another store
     - No breaking changes to single-store employee workflow
*/

-- First, fix the is_technician_checked_in_today function with schema qualification
CREATE OR REPLACE FUNCTION public.is_technician_checked_in_today(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_checked_in boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.attendance_records
    WHERE employee_id = p_employee_id
      AND store_id = p_store_id
      AND work_date = CURRENT_DATE
      AND status = 'checked_in'
      AND check_in_time IS NOT NULL
      AND check_out_time IS NULL
  ) INTO v_checked_in;

  RETURN v_checked_in;
END;
$$;

-- Set secure search_path
ALTER FUNCTION public.is_technician_checked_in_today(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- Create new helper function to check if employee is checked in at ANY store
CREATE OR REPLACE FUNCTION public.is_technician_checked_in_any_store_today(
  p_employee_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_checked_in boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.attendance_records
    WHERE employee_id = p_employee_id
      AND work_date = CURRENT_DATE
      AND status = 'checked_in'
      AND check_in_time IS NOT NULL
      AND check_out_time IS NULL
  ) INTO v_checked_in;

  RETURN v_checked_in;
END;
$$;

-- Set secure search_path
ALTER FUNCTION public.is_technician_checked_in_any_store_today(p_employee_id uuid) SET search_path = '';

-- Update join_ready_queue_with_checkin to allow multi-store employees
CREATE OR REPLACE FUNCTION public.join_ready_queue_with_checkin(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attendance record;
  v_today date;
  v_all_completed boolean;
  v_ticket_id uuid;
  v_is_multi_store boolean;
  v_checked_in_any_store boolean;
BEGIN
  v_today := CURRENT_DATE;

  -- Check if employee has multiple stores
  SELECT COUNT(*) > 1 INTO v_is_multi_store
  FROM public.employee_stores
  WHERE employee_id = p_employee_id;

  -- For multi-store employees, check if they're checked in at ANY store today
  -- For single-store employees, check if they're checked in at the specific store
  IF v_is_multi_store THEN
    v_checked_in_any_store := public.is_technician_checked_in_any_store_today(p_employee_id);
    
    IF NOT v_checked_in_any_store THEN
      RETURN json_build_object(
        'success', false,
        'error', 'CHECK_IN_REQUIRED',
        'message', 'You must check in before joining the ready queue'
      );
    END IF;
  ELSE
    -- Single store employee - must be checked in at this specific store
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
  END IF;

  -- Mark individual services (ticket_items) assigned to this technician as completed
  -- Only mark services at the target store
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

  -- For each affected ticket at this store, check if ALL services are now completed
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

  -- Remove any existing entry for this technician at this store
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id;

  -- Add technician to ready queue at the target store
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

-- Set secure search_path
ALTER FUNCTION public.join_ready_queue_with_checkin(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- Add helpful comments
COMMENT ON FUNCTION public.is_technician_checked_in_any_store_today IS 'Check if technician is checked in at any store today. Used for multi-store employees.';
COMMENT ON FUNCTION public.join_ready_queue_with_checkin IS 'Join ready queue with attendance validation. Multi-store employees can join any store queue if checked in anywhere.';
