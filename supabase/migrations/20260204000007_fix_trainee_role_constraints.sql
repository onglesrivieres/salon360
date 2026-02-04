-- Fix Trainee role constraints on both employees and role_permissions tables
-- Problem: employees_role_check constraint doesn't include 'Trainee' and exists alongside employees_role_valid
-- Problem: role_permissions.valid_role_name doesn't include 'Trainee'

-- 1. Drop the old redundant constraint that doesn't include Trainee
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;

-- 2. Recreate the valid constraint with Trainee included
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_valid;
ALTER TABLE public.employees ADD CONSTRAINT employees_role_valid
  CHECK (role <@ ARRAY['Technician','Trainee','Receptionist','Manager','Owner','Supervisor','Cashier','Spa Expert','Admin']::text[]);

-- 3. Fix role_permissions table to allow Trainee role
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS valid_role_name;
ALTER TABLE public.role_permissions ADD CONSTRAINT valid_role_name
  CHECK (role_name IN ('Admin','Owner','Manager','Supervisor','Receptionist','Technician','Trainee','Spa Expert','Cashier'));
