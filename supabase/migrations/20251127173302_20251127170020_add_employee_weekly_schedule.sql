/*
  # Add Weekly Schedule to Employees

  ## Overview
  This migration adds weekly scheduling capability to employees, allowing managers to set
  which days each employee is scheduled to work.

  ## Changes

  1. Schema Changes
    - Add weekly_schedule column (jsonb) to employees table
    - Structure: {"monday": true, "tuesday": false, "wednesday": true, ...}
    - Default: All days true (available every day)

  2. Data Migration
    - Backfill all existing employees with default schedule (all days available)

  3. Indexes
    - Add GIN index on weekly_schedule for efficient querying

  4. Validation
    - Add check constraint to ensure valid day names if provided

  ## Usage
  - Managers/Owners can edit schedules in Employee form
  - Ticket Editor filters employees by selected date
  - NULL schedule = available all days (backward compatibility)
*/

-- Step 1: Add weekly_schedule column to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS weekly_schedule jsonb DEFAULT '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": true, "sunday": true}'::jsonb;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN public.employees.weekly_schedule IS 'Weekly work schedule. Keys: monday, tuesday, wednesday, thursday, friday, saturday, sunday. Values: boolean (true = working, false = not working). NULL = available all days.';

-- Step 3: Backfill existing employees with default schedule (all days available)
UPDATE public.employees
SET weekly_schedule = '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": true, "sunday": true}'::jsonb
WHERE weekly_schedule IS NULL;

-- Step 4: Add GIN index for efficient JSON querying
CREATE INDEX IF NOT EXISTS idx_employees_weekly_schedule ON public.employees USING GIN (weekly_schedule);

-- Step 5: Add validation function to ensure proper schedule format (optional but recommended)
CREATE OR REPLACE FUNCTION public.validate_weekly_schedule()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow NULL (means available all days)
  IF NEW.weekly_schedule IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check that only valid day names are used
  IF NEW.weekly_schedule ?& ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] THEN
    -- Check that all values are booleans
    IF (
      SELECT bool_and(jsonb_typeof(value) = 'boolean')
      FROM jsonb_each(NEW.weekly_schedule)
      WHERE key IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- If validation fails, raise an error
  RAISE EXCEPTION 'Invalid weekly_schedule format. Must contain valid day names (monday-sunday) with boolean values.';
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to validate schedule on insert/update
DROP TRIGGER IF EXISTS validate_weekly_schedule_trigger ON public.employees;
CREATE TRIGGER validate_weekly_schedule_trigger
  BEFORE INSERT OR UPDATE OF weekly_schedule ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_weekly_schedule();