/*
  # Fix Weekly Schedule Validation Function

  ## Overview
  This migration fixes the validation function for weekly_schedule that was causing
  "Operation failed" errors when saving employee schedules.

  ## Problem
  The original validation used the ?& operator which incorrectly validated the JSONB structure.
  It also had logic flaws that prevented valid schedules from being saved.

  ## Solution
  Replace the validation function with a corrected version that:
  - Properly validates day names (monday-sunday only)
  - Ensures all values are booleans
  - Provides clear error messages
  - Works with any number of days (1-7)

  ## Changes
  1. Drop existing validation function and trigger
  2. Create new corrected validation function
  3. Recreate trigger with new function
*/

-- Step 1: Drop existing trigger and function
DROP TRIGGER IF EXISTS validate_weekly_schedule_trigger ON public.employees;
DROP FUNCTION IF EXISTS public.validate_weekly_schedule();

-- Step 2: Create corrected validation function
CREATE OR REPLACE FUNCTION public.validate_weekly_schedule()
RETURNS TRIGGER AS $$
DECLARE
  valid_days TEXT[] := ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  schedule_key TEXT;
BEGIN
  -- Allow NULL (means available all days)
  IF NEW.weekly_schedule IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check each key in the schedule
  FOR schedule_key IN SELECT jsonb_object_keys(NEW.weekly_schedule)
  LOOP
    -- Check if key is a valid day name
    IF NOT (schedule_key = ANY(valid_days)) THEN
      RAISE EXCEPTION 'Invalid day name in weekly_schedule: %. Valid days are: monday, tuesday, wednesday, thursday, friday, saturday, sunday', schedule_key;
    END IF;
    
    -- Check if value is a boolean
    IF jsonb_typeof(NEW.weekly_schedule->schedule_key) != 'boolean' THEN
      RAISE EXCEPTION 'Invalid value type for day %. Must be boolean, got: %', schedule_key, jsonb_typeof(NEW.weekly_schedule->schedule_key);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Recreate trigger with corrected function
CREATE TRIGGER validate_weekly_schedule_trigger
  BEFORE INSERT OR UPDATE OF weekly_schedule ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_weekly_schedule();