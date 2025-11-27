/*
  # Fix Check-in Function Timezone Handling

  1. Overview
     - Updates check_in_employee function to use EST timezone for date
     - Ensures complete consistency across all attendance functions
     - Prevents any potential date mismatch issues

  2. Changes
     - Replace CURRENT_DATE with EST-aware date calculation
     - Use (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
     - Maintain all other logic and security settings
*/

-- ============================================================================
-- FIX check_in_employee FUNCTION WITH EST TIMEZONE
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
BEGIN
  -- Get current date in EST timezone (same logic as frontend)
  v_work_date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date;

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
COMMENT ON FUNCTION public.check_in_employee IS 'Creates attendance record for employee check-in. Uses EST timezone for date. All tables fully qualified for security.';
