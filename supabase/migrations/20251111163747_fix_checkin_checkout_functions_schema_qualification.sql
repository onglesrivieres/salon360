/*
  # Fix Check-in/Check-out Functions Schema Qualification

  1. Overview
     - Adds explicit schema qualifications (public.) to all table references
     - Fixes the "relation 'stores' does not exist" error
     - Makes functions compatible with empty search_path security setting

  2. Functions Fixed
     - can_checkin_now()
     - check_in_employee()
     - check_out_employee()
     - get_store_attendance()

  3. Security
     - Maintains security by working with empty search_path
     - Prevents search_path manipulation attacks
*/

-- ============================================================================
-- FIX can_checkin_now FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_checkin_now(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_opening_hours jsonb;
  v_opening_time time;
  v_current_time time;
  v_current_day text;
  v_check_in_window_start time;
BEGIN
  -- Get current day of week (lowercase)
  v_current_day := lower(to_char(NOW() AT TIME ZONE 'America/New_York', 'Day'));
  v_current_day := trim(v_current_day);

  -- Get store opening hours
  SELECT opening_hours INTO v_opening_hours
  FROM public.stores
  WHERE id = p_store_id;

  -- If opening_hours is set, use day-specific time
  IF v_opening_hours IS NOT NULL THEN
    v_opening_time := (v_opening_hours->>v_current_day)::time;
  END IF;

  -- Fallback to opening_time column if opening_hours not set
  IF v_opening_time IS NULL THEN
    SELECT opening_time INTO v_opening_time
    FROM public.stores
    WHERE id = p_store_id;
  END IF;

  IF v_opening_time IS NULL THEN
    RETURN true; -- Allow if no opening time set
  END IF;

  -- Get current time in store's timezone (Eastern Time)
  v_current_time := (NOW() AT TIME ZONE 'America/New_York')::time;

  -- Calculate check-in window start (15 minutes before opening)
  v_check_in_window_start := v_opening_time - interval '15 minutes';

  -- Allow check-in if current time is within window
  RETURN v_current_time >= v_check_in_window_start;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.can_checkin_now(p_store_id uuid) SET search_path = '';

-- ============================================================================
-- FIX check_in_employee FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_in_employee(
  p_employee_id uuid,
  p_store_id uuid,
  p_pay_type text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_record_id uuid;
  v_work_date date := CURRENT_DATE;
BEGIN
  -- Check if already checked in (no checkout yet)
  SELECT id INTO v_record_id
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = v_work_date
    AND status = 'checked_in'
    AND check_out_time IS NULL
  ORDER BY check_in_time DESC
  LIMIT 1;

  IF v_record_id IS NOT NULL THEN
    RETURN v_record_id;
  END IF;

  -- Create new attendance record (new session)
  INSERT INTO public.attendance_records (
    employee_id,
    store_id,
    work_date,
    check_in_time,
    last_activity_time,
    pay_type,
    status
  ) VALUES (
    p_employee_id,
    p_store_id,
    v_work_date,
    now(),
    now(),
    p_pay_type,
    'checked_in'
  )
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.check_in_employee(p_employee_id uuid, p_store_id uuid, p_pay_type text) SET search_path = '';

-- ============================================================================
-- FIX check_out_employee FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_out_employee(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_check_in_time timestamptz;
  v_hours numeric;
  v_record_id uuid;
BEGIN
  -- Get the most recent checked-in record without checkout
  SELECT id, check_in_time 
  INTO v_record_id, v_check_in_time
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = CURRENT_DATE
    AND status = 'checked_in'
    AND check_out_time IS NULL
  ORDER BY check_in_time DESC
  LIMIT 1;

  IF v_check_in_time IS NULL THEN
    RETURN false;
  END IF;

  -- Calculate hours worked
  v_hours := EXTRACT(EPOCH FROM (now() - v_check_in_time)) / 3600;

  -- Update attendance record
  UPDATE public.attendance_records
  SET
    check_out_time = now(),
    status = 'checked_out',
    total_hours = v_hours,
    updated_at = now()
  WHERE id = v_record_id;

  RETURN true;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.check_out_employee(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- ============================================================================
-- FIX get_store_attendance FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_store_attendance(
  p_store_id uuid,
  p_start_date date,
  p_end_date date,
  p_employee_id uuid DEFAULT NULL
)
RETURNS TABLE (
  attendance_record_id uuid,
  employee_id uuid,
  employee_name text,
  work_date date,
  check_in_time timestamptz,
  check_out_time timestamptz,
  total_hours numeric,
  status text,
  pay_type text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id as attendance_record_id,
    ar.employee_id,
    e.display_name as employee_name,
    ar.work_date,
    ar.check_in_time,
    ar.check_out_time,
    ar.total_hours,
    ar.status,
    ar.pay_type
  FROM public.attendance_records ar
  JOIN public.employees e ON ar.employee_id = e.id
  WHERE ar.store_id = p_store_id
    AND ar.work_date BETWEEN p_start_date AND p_end_date
    AND (p_employee_id IS NULL OR ar.employee_id = p_employee_id)
  ORDER BY ar.work_date DESC, ar.check_in_time ASC;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.get_store_attendance(p_store_id uuid, p_start_date date, p_end_date date, p_employee_id uuid) SET search_path = '';

-- Add comments
COMMENT ON FUNCTION public.can_checkin_now IS 'Checks if check-in is allowed based on store opening hours. All tables fully qualified for security.';
COMMENT ON FUNCTION public.check_in_employee IS 'Creates attendance record for employee check-in. All tables fully qualified for security.';
COMMENT ON FUNCTION public.check_out_employee IS 'Updates attendance record for employee check-out. All tables fully qualified for security.';
COMMENT ON FUNCTION public.get_store_attendance IS 'Returns attendance records for store and date range. All tables fully qualified for security.';
