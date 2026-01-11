/*
  # Force Fix: Commission Employee Check-In

  ## Problem
  Previous migrations did not properly replace the check_in_employee function.
  The old function with commission blocking is still active in the database.

  ## Solution
  Use dynamic SQL to find and drop ALL versions of the function regardless of signature,
  then create fresh functions without commission blocking.
*/

-- ============================================================================
-- STEP 1: Force drop ALL versions of check_in_employee using dynamic SQL
-- ============================================================================

DO $$
DECLARE
  func_record RECORD;
  drop_cmd TEXT;
BEGIN
  -- Find and drop all functions named check_in_employee in public schema
  FOR func_record IN
    SELECT p.oid::regprocedure::text AS func_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'check_in_employee'
  LOOP
    drop_cmd := 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
    RAISE NOTICE 'Dropping: %', drop_cmd;
    EXECUTE drop_cmd;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Force drop ALL versions of check_out_employee using dynamic SQL
-- ============================================================================

DO $$
DECLARE
  func_record RECORD;
  drop_cmd TEXT;
BEGIN
  -- Find and drop all functions named check_out_employee in public schema
  FOR func_record IN
    SELECT p.oid::regprocedure::text AS func_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'check_out_employee'
  LOOP
    drop_cmd := 'DROP FUNCTION IF EXISTS ' || func_record.func_signature || ' CASCADE';
    RAISE NOTICE 'Dropping: %', drop_cmd;
    EXECUTE drop_cmd;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 3: Create check_in_employee function WITHOUT commission blocking
-- ============================================================================

CREATE FUNCTION public.check_in_employee(
  p_employee_id uuid,
  p_store_id uuid,
  p_pay_type text DEFAULT 'hourly'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record_id uuid;
  v_work_date date;
  v_check_in_time timestamptz;
  v_store_timezone text;
  v_current_time time;
  v_checkin_allowed_time time := '08:45:00'::time;
  v_has_attendance_display boolean;
  v_employee_pay_type text;
  v_other_store_record RECORD;
  v_hours_worked numeric;
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

  -- Get employee details
  SELECT
    COALESCE(attendance_display, true),
    pay_type
  INTO
    v_has_attendance_display,
    v_employee_pay_type
  FROM public.employees
  WHERE id = p_employee_id;

  -- ALL PAY TYPES ARE ALLOWED (hourly, daily, commission)
  -- No commission blocking here!

  -- Block employees with attendance_display disabled
  IF NOT v_has_attendance_display THEN
    RAISE EXCEPTION 'Employee is not enabled for attendance tracking';
  END IF;

  -- Check if already checked in at THIS store today
  SELECT id INTO v_record_id
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = v_work_date
    AND status = 'checked_in'
    AND check_out_time IS NULL
  ORDER BY check_in_time DESC
  LIMIT 1;

  -- If already checked in at this store, return existing record (idempotent)
  IF v_record_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'work_date', v_work_date,
      'check_in_time', v_check_in_time,
      'already_checked_in', true,
      'record_id', v_record_id
    );
  END IF;

  -- Auto check-out from ANY OTHER store if currently checked in
  FOR v_other_store_record IN
    SELECT id, store_id, check_in_time, work_date
    FROM public.attendance_records
    WHERE employee_id = p_employee_id
      AND store_id != p_store_id
      AND status = 'checked_in'
      AND check_out_time IS NULL
  LOOP
    v_hours_worked := EXTRACT(EPOCH FROM (v_check_in_time - v_other_store_record.check_in_time)) / 3600;

    UPDATE public.attendance_records
    SET
      check_out_time = v_check_in_time,
      status = 'auto_checked_out',
      total_hours = v_hours_worked,
      updated_at = v_check_in_time,
      notes = COALESCE(notes || ' ', '') ||
              'Auto checked-out due to check-in at another store at ' ||
              to_char(v_check_in_time AT TIME ZONE v_store_timezone, 'HH24:MI')
    WHERE id = v_other_store_record.id;
  END LOOP;

  -- Insert new attendance record
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
    COALESCE(p_pay_type, v_employee_pay_type, 'hourly')
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

ALTER FUNCTION public.check_in_employee(uuid, uuid, text) SET search_path = '';

-- ============================================================================
-- STEP 4: Create check_out_employee function WITHOUT commission blocking
-- ============================================================================

CREATE FUNCTION public.check_out_employee(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_check_in_time timestamptz;
  v_hours numeric;
  v_record_id uuid;
  v_work_date date;
  v_store_timezone text;
  v_has_attendance_display boolean;
BEGIN
  -- Get store timezone
  v_store_timezone := public.get_store_timezone(p_store_id);
  v_work_date := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::date;

  -- Get employee attendance_display setting
  SELECT COALESCE(attendance_display, true)
  INTO v_has_attendance_display
  FROM public.employees
  WHERE id = p_employee_id;

  -- ALL PAY TYPES ARE ALLOWED (hourly, daily, commission)
  -- No commission blocking here!

  -- Block employees with attendance_display disabled
  IF NOT v_has_attendance_display THEN
    RAISE EXCEPTION 'Employee is not enabled for attendance tracking';
  END IF;

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
  v_hours := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_check_in_time)) / 3600;

  -- Update attendance record
  UPDATE public.attendance_records
  SET
    check_out_time = CURRENT_TIMESTAMP,
    status = 'checked_out',
    total_hours = v_hours,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = v_record_id;

  RETURN true;
END;
$$;

ALTER FUNCTION public.check_out_employee(uuid, uuid) SET search_path = '';

-- ============================================================================
-- STEP 5: Enable attendance_display for all commission employees
-- ============================================================================

UPDATE public.employees
SET attendance_display = true
WHERE pay_type = 'commission'
  AND (attendance_display IS NULL OR attendance_display = false);
