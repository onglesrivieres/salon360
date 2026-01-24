/*
  # Add Admin as Valid Role

  1. Changes
    - Add 'Admin' to the employees role constraint
    - Backfill existing employees with role_permission='Admin' to include 'Admin' in their role array
    - Ensures role array and role_permission are consistent

  2. Security
    - No RLS policy changes needed
    - Existing policies that check for 'Admin' in role array will now work correctly
*/

-- Drop and recreate employees_role_check constraint to include Admin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_role_check'
    AND conrelid = 'employees'::regclass
  ) THEN
    ALTER TABLE employees DROP CONSTRAINT employees_role_check;
  END IF;
END $$;

ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (
    role <@ ARRAY['Admin', 'Technician', 'Receptionist', 'Manager', 'Owner', 'Spa Expert', 'Supervisor', 'Cashier']::text[]
  );

-- Drop and recreate employees_role_valid constraint to include Admin
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_role_valid'
    AND conrelid = 'employees'::regclass
  ) THEN
    ALTER TABLE employees DROP CONSTRAINT employees_role_valid;
  END IF;
END $$;

ALTER TABLE employees ADD CONSTRAINT employees_role_valid
  CHECK (
    role <@ ARRAY['Admin', 'Technician', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Spa Expert', 'Cashier']::text[]
  );

-- Backfill: Add 'Admin' to role array for employees with role_permission='Admin'
UPDATE employees
SET role = array_append(role, 'Admin')
WHERE role_permission = 'Admin'
  AND NOT ('Admin' = ANY(role));