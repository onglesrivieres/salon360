/*
  # Add Skip Queue on Check-in Setting

  ## Overview
  Adds a new employee setting to allow hourly technicians to check in
  without automatically joining the ready queue.

  ## Changes

  ### Tables
  - `employees` - Add `skip_queue_on_checkin` boolean column (DEFAULT false)

  ## Notes
  - This setting is only applicable to employees with Technician role and hourly pay_type
  - When true, the employee checks in but does NOT join the queue automatically
  - When false (default), normal behavior: check in and join queue
*/

-- ============================================================================
-- TABLES
-- ============================================================================

-- Add skip_queue_on_checkin column idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employees'
      AND column_name = 'skip_queue_on_checkin'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN skip_queue_on_checkin boolean DEFAULT false;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.employees.skip_queue_on_checkin IS 'When true, hourly technicians check in without automatically joining the ready queue';
