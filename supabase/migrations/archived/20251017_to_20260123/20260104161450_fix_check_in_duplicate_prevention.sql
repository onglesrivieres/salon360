/*
  # Fix Check-In Function - Add Missing Duplicate Prevention

  ## Overview
  Fixes the check_in_employee function to properly prevent duplicate check-ins.
  The current version is missing critical logic to check if an employee already
  has an active (checked_in with NULL check_out_time) session before attempting
  to INSERT a new record.

  ## Issue
  The function from migration 20260104160951 attempts to INSERT without first
  checking for existing active sessions, causing:
  - Potential duplicate records
  - Database errors
  - Employees unable to check in

  ## Solution
  Add check for existing active check-in session (status='checked_in' AND check_out_time IS NULL)
  before attempting INSERT. Return existing record ID if found, only create new record if needed.

  ## Changes
  1. Check for existing active check-in session
  2. Return existing session if found (idempotent operation)
  3. Only INSERT new record if no active session exists
  4. Maintain all recent improvements:
     - 8:45 AM EST check-in validation
     - attendance_display validation
     - last_activity_time field
     - jsonb response format
     - timezone handling
     - security measures (search_path, schema qualification)

  ## Impact
  - Employees can successfully check in after 8:45 AM EST
  - No duplicate check-in records created
  - Function is idempotent (safe to call multiple times)
  - All recent improvements preserved
*/

-- ============================================================================
-- DROP AND RECREATE check_in_employee FUNCTION WITH COMPLETE LOGIC
-- ============================================================================

DROP FUNCTION IF EXISTS public.check_in_employee(uuid, uuid, text);

CREATE FUNCTION public.check_in_employee(
  p_employee_id uuid,
  p_store_id uuid,
  p_pay_type text DEFAULT 'hourly'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_record_id uuid;
  v_work_date date;
  v_check_in_time timestamptz;
  v_store_timezone text;
  v_current_time time;
  v_checkin_allowed_time time := '08:45:00'::time;
  v_has_attendance_display boolean;
BEGIN
  -- Get store timezone
  v_store_timezone := public.get_store_timezone(p_store_id);

  -- Get current date and time in store's timezone
  v_work_date := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::date;
  v_check_in_time := CURRENT_TIMESTAMP;
  v_current_time := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::time;

  -- Validate check-in is at or after 8:45 AM in store timezone
  IF v_current_time < v_checkin_allowed_time THEN
    RAISE EXCEPTION 'Check-in is available starting at 8:45 AM EST daily';
  END IF;

  -- Check if employee has attendance_display enabled
  SELECT COALESCE(attendance_display, true) INTO v_has_attendance_display
  FROM public.employees
  WHERE id = p_employee_id;

  IF NOT v_has_attendance_display THEN
    RAISE EXCEPTION 'Employee is not enabled for attendance tracking';
  END IF;

  -- CRITICAL: Check if already checked in (no checkout yet)
  -- This prevents duplicate check-in records
  SELECT id INTO v_record_id
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = v_work_date
    AND status = 'checked_in'
    AND check_out_time IS NULL
  ORDER BY check_in_time DESC
  LIMIT 1;

  -- If already checked in, return existing record (idempotent operation)
  IF v_record_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'work_date', v_work_date,
      'check_in_time', v_check_in_time,
      'already_checked_in', true,
      'record_id', v_record_id
    );
  END IF;

  -- Insert new attendance record with last_activity_time
  INSERT INTO public.attendance_records (
    employee_id,
    store_id,
    work_date,
    check_in_time,
    last_activity_time,
    status,
    pay_type
  )
  VALUES (
    p_employee_id,
    p_store_id,
    v_work_date,
    v_check_in_time,
    v_check_in_time,
    'checked_in',
    p_pay_type
  )
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object(
    'success', true,
    'work_date', v_work_date,
    'check_in_time', v_check_in_time,
    'already_checked_in', false,
    'record_id', v_record_id
  );
END;
$$;

ALTER FUNCTION public.check_in_employee(p_employee_id uuid, p_store_id uuid, p_pay_type text) SET search_path = '';

COMMENT ON FUNCTION public.check_in_employee IS 'Creates attendance record for employee check-in. Validates check-in is at or after 8:45 AM in store timezone. Checks for existing active session to prevent duplicates (idempotent). Includes last_activity_time for daily employee tracking. All tables fully qualified for security.';