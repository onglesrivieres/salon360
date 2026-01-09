/*
  # Add Cashier Role Support

  1. Changes
    - Add 'Cashier' to the valid role values in employees table
    - Update role constraint to accept Cashier alongside existing roles:
      Technician, Receptionist, Manager, Owner, Spa Expert, Supervisor

  2. Security
    - No RLS policy changes
    - Existing policies continue to apply
*/

-- Check if the constraint exists and drop it
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

-- Add new constraint that includes Cashier
ALTER TABLE employees ADD CONSTRAINT employees_role_check 
  CHECK (
    role <@ ARRAY['Technician', 'Receptionist', 'Manager', 'Owner', 'Spa Expert', 'Supervisor', 'Cashier']::text[]
  );

-- Update role_permission enum type to add new values
-- Note: ADD VALUE IF NOT EXISTS handles duplicates gracefully
ALTER TYPE role_permission_type ADD VALUE IF NOT EXISTS 'Supervisor';
ALTER TYPE role_permission_type ADD VALUE IF NOT EXISTS 'Owner';
ALTER TYPE role_permission_type ADD VALUE IF NOT EXISTS 'Cashier';
