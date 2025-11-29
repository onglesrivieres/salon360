/*
  # Add Cashier Role Support (Complete)

  1. Changes
    - Add 'Cashier' to all role constraint checks in employees table
    - Update both employees_role_check and employees_role_valid constraints

  2. Security
    - No RLS policy changes
    - Existing policies continue to apply
*/

-- Drop and recreate employees_role_check constraint
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
    role <@ ARRAY['Technician', 'Receptionist', 'Manager', 'Owner', 'Spa Expert', 'Supervisor', 'Cashier']::text[]
  );

-- Drop and recreate employees_role_valid constraint
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
    role <@ ARRAY['Technician', 'Receptionist', 'Supervisor', 'Manager', 'Owner', 'Spa Expert', 'Cashier']::text[]
  );

-- Drop and recreate role_permission constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'employees_role_permission_check' 
    AND conrelid = 'employees'::regclass
  ) THEN
    ALTER TABLE employees DROP CONSTRAINT employees_role_permission_check;
  END IF;
END $$;

ALTER TABLE employees ADD CONSTRAINT employees_role_permission_check 
  CHECK (
    role_permission IN ('Admin', 'Receptionist', 'Technician', 'Supervisor', 'Owner', 'Cashier')
  );
