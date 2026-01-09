/*
  # Add Commission Pay Type

  ## Problem
  The frontend allows selecting 'commission' as a pay_type option for employees,
  but the database constraint only allows 'hourly' or 'daily'. This causes
  "Operation failed" errors when creating/saving employees with Commission pay type.

  ## Solution
  Update the constraint to include 'commission' as a valid pay_type value.
*/

-- Drop the existing constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_pay_type_valid;

-- Add updated constraint that includes 'commission'
ALTER TABLE employees ADD CONSTRAINT employees_pay_type_valid
  CHECK (pay_type IN ('hourly', 'daily', 'commission'));
