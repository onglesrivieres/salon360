/*
  # Fix Weekly Schedule Validation for Object Format

  ## Overview
  This migration updates the validation trigger to accept the new object format
  for weekly_schedule that was introduced in migration 20251129072303.

  ## Problem
  The previous validation function expected boolean values:
    {"monday": true, "tuesday": false}

  But the data was converted to object format:
    {"monday": {"is_working": true, "start_time": "09:00", "end_time": "18:00"}}

  The old validation trigger was blocking all employee updates with:
    "Invalid value type for day. Must be boolean, got: object"

  ## Solution
  Replace the validation function to validate the new object structure:
  - Each day must be an object with is_working (boolean), start_time (string), end_time (string)
  - Validate day names (monday-sunday only)
  - Validate time format (HH:MM)
  - Provide clear error messages

  ## Changes
  1. Drop existing validation trigger and function
  2. Create new validation function for object format
  3. Recreate trigger with new function
*/

-- Step 1: Drop existing trigger and function
DROP TRIGGER IF EXISTS validate_weekly_schedule_trigger ON public.employees;
DROP FUNCTION IF EXISTS public.validate_weekly_schedule();

-- Step 2: Create new validation function for object format
CREATE OR REPLACE FUNCTION public.validate_weekly_schedule()
RETURNS TRIGGER AS $$
DECLARE
  valid_days TEXT[] := ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  schedule_key TEXT;
  day_schedule JSONB;
  is_working_value JSONB;
  start_time_value JSONB;
  end_time_value JSONB;
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

    day_schedule := NEW.weekly_schedule->schedule_key;

    -- Check if value is an object
    IF jsonb_typeof(day_schedule) != 'object' THEN
      RAISE EXCEPTION 'Invalid value type for day %. Must be object with is_working, start_time, and end_time properties, got: %', schedule_key, jsonb_typeof(day_schedule);
    END IF;

    -- Check for required properties
    IF NOT (day_schedule ? 'is_working') THEN
      RAISE EXCEPTION 'Missing required property is_working for day %', schedule_key;
    END IF;

    IF NOT (day_schedule ? 'start_time') THEN
      RAISE EXCEPTION 'Missing required property start_time for day %', schedule_key;
    END IF;

    IF NOT (day_schedule ? 'end_time') THEN
      RAISE EXCEPTION 'Missing required property end_time for day %', schedule_key;
    END IF;

    -- Validate is_working is boolean
    is_working_value := day_schedule->'is_working';
    IF jsonb_typeof(is_working_value) != 'boolean' THEN
      RAISE EXCEPTION 'Invalid type for is_working in day %. Must be boolean, got: %', schedule_key, jsonb_typeof(is_working_value);
    END IF;

    -- Validate start_time is string
    start_time_value := day_schedule->'start_time';
    IF jsonb_typeof(start_time_value) != 'string' THEN
      RAISE EXCEPTION 'Invalid type for start_time in day %. Must be string, got: %', schedule_key, jsonb_typeof(start_time_value);
    END IF;

    -- Validate end_time is string
    end_time_value := day_schedule->'end_time';
    IF jsonb_typeof(end_time_value) != 'string' THEN
      RAISE EXCEPTION 'Invalid type for end_time in day %. Must be string, got: %', schedule_key, jsonb_typeof(end_time_value);
    END IF;

    -- Optional: Validate time format (HH:MM)
    -- This regex ensures format like "09:00" or "18:30"
    IF NOT (day_schedule->>'start_time' ~ '^\d{2}:\d{2}$') THEN
      RAISE EXCEPTION 'Invalid time format for start_time in day %. Expected HH:MM format, got: %', schedule_key, day_schedule->>'start_time';
    END IF;

    IF NOT (day_schedule->>'end_time' ~ '^\d{2}:\d{2}$') THEN
      RAISE EXCEPTION 'Invalid time format for end_time in day %. Expected HH:MM format, got: %', schedule_key, day_schedule->>'end_time';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Recreate trigger with new validation function
CREATE TRIGGER validate_weekly_schedule_trigger
  BEFORE INSERT OR UPDATE OF weekly_schedule ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_weekly_schedule();
