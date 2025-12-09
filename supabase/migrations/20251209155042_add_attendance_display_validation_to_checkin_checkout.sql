/*
  # Add attendance_display Validation to Check-in/Check-out Functions

  1. Overview
     - Adds server-side validation to prevent check-in/out for employees with attendance_display = false
     - Provides meaningful error messages when validation fails
     - Maintains backward compatibility (NULL treated as true)

  2. Changes Made
     - Update check_in_employee to validate attendance_display before creating records
     - Update check_out_employee to validate attendance_display before updating records
     - Raise exceptions with clear error messages when validation fails

  3. Security
     - Server-side protection ensures attendance rules cannot be bypassed
     - Complements client-side validation for defense-in-depth
     - Maintains empty search_path for security
*/

-- ============================================================================
-- UPDATE check_in_employee WITH attendance_display VALIDATION
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
  v_work_date date;
  v_attendance_display boolean;
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
COMMENT ON FUNCTION public.check_in_employee IS 'Creates attendance record for employee check-in. Validates attendance_display is enabled. Uses EST timezone for date. All tables fully qualified for security.';

-- ============================================================================
-- UPDATE check_out_employee WITH attendance_display VALIDATION
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
  v_attendance_display boolean;
BEGIN
  -- Check if employee has attendance display enabled
  SELECT COALESCE(attendance_display, true) INTO v_attendance_display
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT v_attendance_display THEN
    RAISE EXCEPTION 'Attendance tracking is not enabled for your account';
  END IF;

  -- Get the most recent checked-in record without checkout
  SELECT id, check_in_time 
  INTO v_record_id, v_check_in_time
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
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

-- Add comment
COMMENT ON FUNCTION public.check_out_employee IS 'Updates attendance record for employee check-out. Validates attendance_display is enabled. Uses EST timezone for date. All tables fully qualified for security.';
