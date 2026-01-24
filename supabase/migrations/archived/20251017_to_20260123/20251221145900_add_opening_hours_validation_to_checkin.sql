/*
  # Add Opening Hours Validation to Check-in Function

  1. Overview
     - Updates check_in_employee function to validate opening hours before allowing check-in
     - Calls can_checkin_now() to enforce the 75-minute early check-in window
     - Provides clear error message when check-in is attempted too early

  2. Changes
     - Add validation call to can_checkin_now() at the start of check_in_employee
     - Raise descriptive exception if check-in is attempted before allowed time
     - Include store opening time and allowed check-in time in error message

  3. Impact
     - Employees will now receive a clear error message when checking in too early
     - Error message explains when they can check in
     - Prevents silent failures that confused users

  4. Example Error Message
     - "Check-in is not available yet. You can check in starting at 8:45 AM (75 minutes before opening)."
*/

-- Update check_in_employee function with opening hours validation
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
  v_work_date date;
  v_attendance_display boolean;
  v_can_checkin boolean;
  v_opening_hours jsonb;
  v_opening_time time;
  v_current_day text;
  v_check_in_window_start time;
BEGIN
  -- Get current date in EST timezone (same logic as frontend)
  v_work_date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date;

  -- Check if employee has attendance display enabled
  SELECT COALESCE(attendance_display, true) INTO v_attendance_display
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT v_attendance_display THEN
    RAISE EXCEPTION 'Attendance tracking is not enabled for your account';
  END IF;

  -- Validate opening hours - check if check-in is allowed now
  v_can_checkin := public.can_checkin_now(p_store_id);
  
  IF NOT v_can_checkin THEN
    -- Get opening time to include in error message
    v_current_day := lower(trim(to_char(NOW() AT TIME ZONE 'America/New_York', 'Day')));
    
    SELECT opening_hours INTO v_opening_hours
    FROM public.stores
    WHERE id = p_store_id;
    
    IF v_opening_hours IS NOT NULL THEN
      v_opening_time := (v_opening_hours->>v_current_day)::time;
    END IF;
    
    IF v_opening_time IS NULL THEN
      SELECT opening_time INTO v_opening_time
      FROM public.stores
      WHERE id = p_store_id;
    END IF;
    
    -- Calculate when check-in becomes available (75 minutes before opening)
    v_check_in_window_start := v_opening_time - interval '75 minutes';
    
    RAISE EXCEPTION 'Check-in is not available yet. You can check in starting at % (75 minutes before opening at %).',
      to_char(v_check_in_window_start, 'HH12:MI AM'),
      to_char(v_opening_time, 'HH12:MI AM');
  END IF;

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

-- Add comment
COMMENT ON FUNCTION public.check_in_employee IS 'Creates attendance record for employee check-in. Validates attendance_display and opening hours. Uses EST timezone for date. All tables fully qualified for security.';
