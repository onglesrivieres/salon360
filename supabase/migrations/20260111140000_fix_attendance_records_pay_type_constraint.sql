-- Fix attendance_records pay_type constraint to allow commission employees
-- This resolves the check-in error for commission employees who get:
-- "new row for relation attendance_records violates check constraint attendance_records_pay_type_check"

-- Drop the existing inline constraint (PostgreSQL assigns a system-generated name)
-- The constraint name pattern is: {table}_{column}_check
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_pay_type_check;

-- Add the updated constraint with all three pay types
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_pay_type_check
  CHECK (pay_type IN ('hourly', 'daily', 'commission'));
