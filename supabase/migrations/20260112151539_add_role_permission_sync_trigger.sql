/*
  # Add Trigger to Auto-Sync role_permission from role Array

  ## Problem
  The role_permission column was being set manually in the frontend and migrations,
  leading to sync bugs when the logic was incorrect (e.g., using scalar comparison
  on array columns, or missing the 'Admin' role handling).

  ## Solution
  Create a database trigger that automatically computes role_permission from the
  role array whenever an employee is inserted or their role is updated.

  ## Mapping Rules
  - Admin/Manager/Owner in role array → 'Admin' permission
  - Supervisor in role array → 'Supervisor' permission
  - Receptionist in role array → 'Receptionist' permission
  - Cashier in role array → 'Cashier' permission
  - Otherwise → 'Technician' permission

  Priority: Admin > Supervisor > Receptionist > Cashier > Technician
*/

-- Function to compute role_permission from role array
CREATE OR REPLACE FUNCTION public.compute_role_permission(roles text[])
RETURNS text AS $$
BEGIN
  RETURN CASE
    WHEN 'Admin' = ANY(roles) OR 'Manager' = ANY(roles) OR 'Owner' = ANY(roles) THEN 'Admin'
    WHEN 'Supervisor' = ANY(roles) THEN 'Supervisor'
    WHEN 'Receptionist' = ANY(roles) THEN 'Receptionist'
    WHEN 'Cashier' = ANY(roles) THEN 'Cashier'
    ELSE 'Technician'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger function to auto-set role_permission before insert/update
CREATE OR REPLACE FUNCTION public.sync_role_permission()
RETURNS TRIGGER AS $$
BEGIN
  NEW.role_permission := public.compute_role_permission(NEW.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trg_sync_role_permission ON public.employees;

-- Create trigger on INSERT and UPDATE of role column
CREATE TRIGGER trg_sync_role_permission
  BEFORE INSERT OR UPDATE OF role ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_role_permission();

-- Fix all existing employees to ensure consistency
UPDATE public.employees SET role_permission = public.compute_role_permission(role);

-- Add comment documenting the trigger
COMMENT ON TRIGGER trg_sync_role_permission ON public.employees IS
  'Automatically syncs role_permission enum from role array on insert/update';
