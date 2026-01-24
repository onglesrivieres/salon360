/*
  # Fix Check-out Function Timezone Handling

  1. Overview
     - Updates check_out_employee function to use EST timezone for date comparison
     - Ensures consistency between frontend EST dates and backend database queries
     - Prevents date mismatch issues when checking out employees

  2. Problem
     - Frontend uses getCurrentDateEST() which returns EST date
     - Database function was using CURRENT_DATE (UTC date)
     - When it's past midnight UTC but before midnight EST, dates don't match
     - This causes check-out to fail with "No active check-in found"

  3. Solution
     - Use (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date for EST date
     - This ensures the function uses the same date logic as the frontend
     - Applies to check_out_employee function

  4. Changes
     - Replace CURRENT_DATE with EST-aware date calculation
     - Maintain all other logic and security settings
*/

-- ============================================================================
-- FIX check_out_employee FUNCTION WITH EST TIMEZONE
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
  v_work_date date;
BEGIN
  -- Get current date in EST timezone (same logic as frontend)
  v_work_date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date;

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

-- Set search_path to empty for security
ALTER FUNCTION public.check_out_employee(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- Add comment
COMMENT ON FUNCTION public.check_out_employee IS 'Updates attendance record for employee check-out. Uses EST timezone for date matching. All tables fully qualified for security.';
