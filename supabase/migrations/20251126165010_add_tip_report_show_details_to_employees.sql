/*
  # Add Tip Report Detail Privacy Control

  1. Changes
    - Add `tip_report_show_details` column to `employees` table
      - Type: boolean
      - Default: true (shows full details by default)
      - Controls whether employee can see detailed tip breakdowns in their personal tip report
  
  2. Purpose
    - Allows management to control privacy level of tip reports for individual employees
    - When true: employee sees full detailed breakdown (tips by customer/receptionist, cash/card, per service)
    - When false: employee only sees total tip amounts in summary and per ticket
  
  3. Notes
    - This setting only affects the employee's own view of their tip report
    - Admins, Managers, Supervisors, and Owners always see full details regardless
    - Default is true to maintain existing behavior for all current employees
*/

-- Add tip_report_show_details column to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'tip_report_show_details'
  ) THEN
    ALTER TABLE public.employees ADD COLUMN tip_report_show_details boolean DEFAULT true;
  END IF;
END $$;