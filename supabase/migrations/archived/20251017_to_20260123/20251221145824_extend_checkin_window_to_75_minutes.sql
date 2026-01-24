/*
  # Extend Check-in Window from 15 Minutes to 75 Minutes

  1. Overview
     - Updates can_checkin_now function to allow check-ins up to 75 minutes before store opening
     - Solves issue where employees arriving early (e.g., 9:00 AM for 10:00 AM opening) cannot check in
     - Previous 15-minute window was too restrictive for early-arriving employees

  2. Changes
     - Modify check-in window calculation from 15 minutes to 75 minutes before opening time
     - Example: For 10:00 AM opening, employees can now check in from 8:45 AM onwards
     - Example: For 9:00 AM opening, employees can now check in from 7:45 AM onwards

  3. Impact
     - Employees can check in much earlier without being blocked
     - Reduces frustration from "too early to check in" scenarios
     - Maintains security by still having an opening time restriction

  4. Notes
     - Function maintains all other validation logic
     - Day-specific opening hours still respected
     - Timezone handling (EST) remains unchanged
*/

-- Update can_checkin_now function with 75-minute early check-in window
CREATE OR REPLACE FUNCTION public.can_checkin_now(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  -- Calculate check-in window start (75 minutes before opening)
  v_check_in_window_start := v_opening_time - interval '75 minutes';

  -- Allow check-in if current time is within window
  RETURN v_current_time >= v_check_in_window_start;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.can_checkin_now IS 'Checks if employees can check in now. Allows check-ins up to 75 minutes before store opening time. Uses day-specific opening hours from opening_hours JSONB or falls back to opening_time column.';
