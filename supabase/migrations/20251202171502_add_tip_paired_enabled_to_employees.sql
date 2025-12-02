/*
  # Add Tip Paired Control to Employees

  1. Changes
    - Add `tip_paired_enabled` column to `employees` table
      - Type: boolean
      - Default: true (enabled by default)
      - Controls whether "Tip Paired by Receptionist" input is active for this employee in Ticket Editor
  
  2. Purpose
    - Allows management to control which employees can receive paired tips from receptionists
    - When true: "Tip Paired by Receptionist" input is active in Payment Details
    - When false: "Tip Paired by Receptionist" input is disabled/inactive for tickets involving this employee
  
  3. Notes
    - Default is true to maintain existing behavior for all current employees
    - Provides granular control over tip pairing at the employee level
*/

-- Add tip_paired_enabled column to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'tip_paired_enabled'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN tip_paired_enabled boolean DEFAULT true;
  END IF;
END $$;