-- Add 'Trainee' to the allowed employee roles
-- Trainee has the same permissions as Technician (handled in frontend via getRolePermission mapping)

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_valid;
ALTER TABLE public.employees ADD CONSTRAINT employees_role_valid
  CHECK (role <@ ARRAY['Technician', 'Trainee', 'Receptionist', 'Manager', 'Owner', 'Supervisor', 'Cashier', 'Spa Expert', 'Admin']::text[]);
