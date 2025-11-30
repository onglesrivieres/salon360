/*
  # Convert Remaining Boolean Schedules to Object Format

  ## Overview
  Some employee records still have the old boolean format for weekly_schedule.
  This migration converts any remaining boolean format schedules to the new object format.

  ## Problem
  Some employees have:
    {"monday": true, "tuesday": false}
  
  But the validation now expects:
    {"monday": {"is_working": true, "start_time": "09:00", "end_time": "18:00"}}

  ## Solution
  Detect and convert any remaining boolean format schedules to object format.

  ## Changes
  1. Temporarily disable validation trigger
  2. Convert boolean format to object format
  3. Re-enable validation trigger
*/

-- Step 1: Temporarily disable the validation trigger
ALTER TABLE public.employees DISABLE TRIGGER validate_weekly_schedule_trigger;

-- Step 2: Convert remaining boolean format schedules to object format
DO $$
DECLARE
  emp_record RECORD;
  new_schedule jsonb;
  day_key text;
  day_value jsonb;
  is_boolean boolean;
BEGIN
  FOR emp_record IN 
    SELECT id, weekly_schedule 
    FROM public.employees 
    WHERE weekly_schedule IS NOT NULL
  LOOP
    -- Check if this schedule has any boolean values
    is_boolean := false;
    
    FOR day_key IN SELECT unnest(ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    LOOP
      IF emp_record.weekly_schedule ? day_key THEN
        IF jsonb_typeof(emp_record.weekly_schedule->day_key) = 'boolean' THEN
          is_boolean := true;
          EXIT;
        END IF;
      END IF;
    END LOOP;
    
    -- If we found boolean format, convert it
    IF is_boolean THEN
      new_schedule := '{}'::jsonb;
      
      FOR day_key IN SELECT unnest(ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
      LOOP
        -- Get the boolean value or default to true if day is missing
        day_value := jsonb_build_object(
          'is_working', COALESCE((emp_record.weekly_schedule->>day_key)::boolean, true),
          'start_time', '09:00',
          'end_time', '18:00'
        );
        
        new_schedule := new_schedule || jsonb_build_object(day_key, day_value);
      END LOOP;
      
      UPDATE public.employees
      SET weekly_schedule = new_schedule
      WHERE id = emp_record.id;
      
      RAISE NOTICE 'Converted schedule for employee %', emp_record.id;
    END IF;
  END LOOP;
END;
$$;

-- Step 3: Re-enable the validation trigger
ALTER TABLE public.employees ENABLE TRIGGER validate_weekly_schedule_trigger;
