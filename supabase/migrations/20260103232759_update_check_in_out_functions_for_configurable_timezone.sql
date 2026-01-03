/*
  # Update Check-In/Out Functions for Configurable Timezone

  1. Overview
    - Updates check_in_employee and check_out_employee functions
    - Uses get_store_timezone() function to fetch configured timezone
    - Replaces hardcoded 'America/New_York' with dynamic timezone
    - Maintains all existing functionality and security settings

  2. Changes
    - check_in_employee: Use configured timezone for date calculation
    - check_out_employee: Use configured timezone for date calculation
    - Both functions now respect store-specific timezone settings
*/

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
  v_store_opening_hours jsonb;
  v_day_of_week text;
  v_opening_time time;
  v_earliest_allowed timestamptz;
  v_has_attendance_display boolean;
BEGIN
  -- Get store timezone
  v_store_timezone := public.get_store_timezone(p_store_id);

  -- Get current date in store's timezone
  v_work_date := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::date;
  v_check_in_time := CURRENT_TIMESTAMP;

  -- Get store opening hours
  SELECT opening_hours INTO v_store_opening_hours
  FROM public.stores
  WHERE id = p_store_id;

  -- Get day of week name
  v_day_of_week := LOWER(TO_CHAR(v_work_date, 'Day'));
  v_day_of_week := TRIM(v_day_of_week);

  -- Get opening time for today
  IF v_store_opening_hours IS NOT NULL AND v_store_opening_hours ? v_day_of_week THEN
    v_opening_time := (v_store_opening_hours ->> v_day_of_week)::time;
    
    -- Calculate earliest allowed check-in (75 minutes before opening)
    v_earliest_allowed := (v_work_date || ' ' || v_opening_time::text)::timestamp AT TIME ZONE v_store_timezone - interval '75 minutes';
    
    -- Check if current time is before the earliest allowed time
    IF v_check_in_time < v_earliest_allowed THEN
      RAISE EXCEPTION 'Cannot check in more than 75 minutes before store opening time';
    END IF;
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

COMMENT ON FUNCTION public.check_in_employee IS 'Creates attendance record for employee check-in. Uses store configured timezone for date matching. All tables fully qualified for security.';

-- ============================================================================
-- UPDATE check_out_employee FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.check_out_employee(uuid, uuid);

CREATE FUNCTION public.check_out_employee(
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
  v_work_date date;
  v_store_timezone text;
BEGIN
  -- Get store timezone
  v_store_timezone := public.get_store_timezone(p_store_id);

  -- Get current date in store's timezone
  v_work_date := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::date;

  -- Get the most recent checked-in record without checkout
  SELECT id, check_in_time 
  INTO v_record_id, v_check_in_time
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = v_work_date
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

ALTER FUNCTION public.check_out_employee(p_employee_id uuid, p_store_id uuid) SET search_path = '';

COMMENT ON FUNCTION public.check_out_employee IS 'Updates attendance record for employee check-out. Uses store configured timezone for date matching. All tables fully qualified for security.';