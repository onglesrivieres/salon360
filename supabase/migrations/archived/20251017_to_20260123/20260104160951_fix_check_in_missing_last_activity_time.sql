/*
  # Fix Check-In Function - Add Missing last_activity_time

  ## Overview
  Restores the last_activity_time field to the check_in_employee function INSERT statement.
  This field is required for daily employees' activity tracking and auto-checkout logic.

  ## Issue
  The 20260104160000 migration removed last_activity_time from the INSERT, causing:
  - Daily employees can't track activity properly
  - Auto-checkout after 3 hours inactivity doesn't work correctly
  - Potential NULL constraint violations if the field has a NOT NULL constraint

  ## Fix
  Add last_activity_time back to both:
  1. The INSERT column list
  2. The VALUES clause (set to current timestamp)

  ## Impact
  - Restores full functionality for daily employee attendance tracking
  - Fixes auto-checkout logic
  - Maintains all other recent improvements (8:45 AM check-in, timezone handling)
*/

-- ============================================================================
-- UPDATE check_in_employee FUNCTION - ADD last_activity_time
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
  );

  RETURN jsonb_build_object(
    'success', true,
    'work_date', v_work_date,
    'check_in_time', v_check_in_time
  );
END;
$$;

ALTER FUNCTION public.check_in_employee(p_employee_id uuid, p_store_id uuid, p_pay_type text) SET search_path = '';

COMMENT ON FUNCTION public.check_in_employee IS 'Creates attendance record for employee check-in. Validates check-in is at or after 8:45 AM in store timezone. Includes last_activity_time for daily employee tracking. All tables fully qualified for security.';
