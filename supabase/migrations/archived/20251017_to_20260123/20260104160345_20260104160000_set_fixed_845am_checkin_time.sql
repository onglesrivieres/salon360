/*
  # Set Fixed 8:45 AM EST Check-In Time

  ## Overview
  Changes check-in validation to use a fixed 8:45 AM EST time instead of calculating
  75 minutes before each store's opening time. This provides a consistent check-in
  experience across all stores regardless of their opening hours.

  ## Changes
  1. Update `can_checkin_now` function
     - Remove dynamic calculation based on opening hours
     - Use fixed 8:45 AM EST time for all stores
     - Employees can check in any time after 8:45 AM EST

  2. Update `check_in_employee` function
     - Replace 75-minute before opening validation with fixed 8:45 AM EST check
     - Update error messages to reflect new policy
     - Maintain timezone handling for date matching

  ## Impact
  - All stores: Check-in available from 8:45 AM EST onwards
  - Consistent check-in time regardless of store opening hours
  - Simpler, more predictable check-in experience for employees

  ## Examples
  - Store opens at 9:00 AM: Can check in from 8:45 AM EST
  - Store opens at 10:00 AM: Can check in from 8:45 AM EST
  - Store opens at 11:00 AM: Can check in from 8:45 AM EST
*/

-- ============================================================================
-- UPDATE can_checkin_now FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_checkin_now(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_time time;
  v_checkin_allowed_time time := '08:45:00'::time;
  v_store_timezone text;
BEGIN
  -- Get store timezone (defaults to America/New_York if not configured)
  v_store_timezone := public.get_store_timezone(p_store_id);

  -- Get current time in store's timezone
  v_current_time := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::time;

  -- Allow check-in if current time is 8:45 AM or later
  RETURN v_current_time >= v_checkin_allowed_time;
END;
$$;

COMMENT ON FUNCTION public.can_checkin_now IS 'Checks if employees can check in now. Allows check-ins starting at 8:45 AM in the store timezone (typically EST). Provides consistent check-in time across all stores.';

-- ============================================================================
-- UPDATE check_in_employee FUNCTION
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

  -- Insert new attendance record
  INSERT INTO public.attendance_records (
    employee_id,
    store_id,
    work_date,
    check_in_time,
    status,
    pay_type
  )
  VALUES (
    p_employee_id,
    p_store_id,
    v_work_date,
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

COMMENT ON FUNCTION public.check_in_employee IS 'Creates attendance record for employee check-in. Validates check-in is at or after 8:45 AM in store timezone. Uses store configured timezone for date matching. All tables fully qualified for security.';
