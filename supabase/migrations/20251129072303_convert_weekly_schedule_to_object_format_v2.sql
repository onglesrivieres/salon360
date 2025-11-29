/*
  # Convert Weekly Schedule Format

  This migration converts the weekly_schedule column from simple boolean format
  to object format with is_working, start_time, and end_time properties.

  ## Changes
  
  1. Disable validation trigger temporarily
  2. Data Conversion
    - Converts `{"monday": true}` to `{"monday": {"is_working": true, "start_time": "09:00", "end_time": "18:00"}}`
    - Converts `{"monday": false}` to `{"monday": {"is_working": false, "start_time": "09:00", "end_time": "18:00"}}`
    - Applies default working hours (9 AM - 6 PM) for all days
    - Handles NULL schedules by setting them to all days available with default hours
  3. Re-enable validation trigger

  ## Notes
  
  - This fixes the issue where employees scheduled for today weren't appearing
  - The function expects object format but data was in simple boolean format
  - Default hours are 9 AM to 6 PM (can be customized per employee later)
*/

-- Step 1: Temporarily disable the validation trigger
ALTER TABLE public.employees DISABLE TRIGGER validate_weekly_schedule_trigger;

-- Step 2: Convert existing weekly_schedule data from boolean to object format
-- This handles schedules that are in the old boolean format
DO $$
DECLARE
  emp_record RECORD;
  new_schedule jsonb;
  day_key text;
  day_value jsonb;
BEGIN
  FOR emp_record IN 
    SELECT id, weekly_schedule 
    FROM public.employees 
    WHERE weekly_schedule IS NOT NULL
      AND jsonb_typeof(weekly_schedule->'monday') = 'boolean'
  LOOP
    new_schedule := '{}'::jsonb;
    
    FOR day_key IN SELECT unnest(ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    LOOP
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
  END LOOP;
END;
$$;

-- Step 3: Handle employees with NULL schedules
UPDATE public.employees
SET weekly_schedule = jsonb_build_object(
  'monday', jsonb_build_object('is_working', true, 'start_time', '09:00', 'end_time', '18:00'),
  'tuesday', jsonb_build_object('is_working', true, 'start_time', '09:00', 'end_time', '18:00'),
  'wednesday', jsonb_build_object('is_working', true, 'start_time', '09:00', 'end_time', '18:00'),
  'thursday', jsonb_build_object('is_working', true, 'start_time', '09:00', 'end_time', '18:00'),
  'friday', jsonb_build_object('is_working', true, 'start_time', '09:00', 'end_time', '18:00'),
  'saturday', jsonb_build_object('is_working', true, 'start_time', '09:00', 'end_time', '18:00'),
  'sunday', jsonb_build_object('is_working', true, 'start_time', '09:00', 'end_time', '18:00')
)
WHERE weekly_schedule IS NULL;

-- Step 4: Re-enable the validation trigger
ALTER TABLE public.employees ENABLE TRIGGER validate_weekly_schedule_trigger;