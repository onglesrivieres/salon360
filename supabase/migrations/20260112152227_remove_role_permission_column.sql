/*
  # Remove role_permission Column from Employees Table

  ## Why
  The role_permission column was a derived value from the role array that caused
  sync bugs. The frontend now computes this value at login time from the role array,
  eliminating the need for this column.

  ## Changes
  1. Drop the sync trigger (no longer needed)
  2. Drop the helper functions (no longer needed)
  3. Update RLS policies to use role array instead of role_permission
  4. Drop the role_permission column
  5. Update verify_employee_pin to not return role_permission
*/

-- 1. Drop the trigger that synced role_permission
DROP TRIGGER IF EXISTS trg_sync_role_permission ON public.employees;

-- 2. Drop the sync functions
DROP FUNCTION IF EXISTS public.sync_role_permission();
DROP FUNCTION IF EXISTS public.compute_role_permission(text[]);

-- 3. Update RLS policies that depend on role_permission
-- First drop the dependent policies, then recreate them using role array

-- Drop store_services policies
DROP POLICY IF EXISTS "Admin, Manager, Supervisor can manage store services" ON public.store_services;

-- Recreate store_services policy using role array
CREATE POLICY "Admin, Manager, Supervisor can manage store services"
  ON public.store_services
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
        AND (
          'Admin' = ANY(employees.role) OR
          'Manager' = ANY(employees.role) OR
          'Supervisor' = ANY(employees.role) OR
          'Owner' = ANY(employees.role)
        )
    )
  );

-- Drop services policies
DROP POLICY IF EXISTS "Admin, Manager, Supervisor, Owner can insert services" ON public.services;
DROP POLICY IF EXISTS "Admin, Manager, Supervisor, Owner can update services" ON public.services;
DROP POLICY IF EXISTS "Only Admin can delete services" ON public.services;

-- Recreate services policies using role array
CREATE POLICY "Admin, Manager, Supervisor, Owner can insert services"
  ON public.services
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
        AND (
          'Admin' = ANY(employees.role) OR
          'Manager' = ANY(employees.role) OR
          'Supervisor' = ANY(employees.role) OR
          'Owner' = ANY(employees.role)
        )
    )
  );

CREATE POLICY "Admin, Manager, Supervisor, Owner can update services"
  ON public.services
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
        AND (
          'Admin' = ANY(employees.role) OR
          'Manager' = ANY(employees.role) OR
          'Supervisor' = ANY(employees.role) OR
          'Owner' = ANY(employees.role)
        )
    )
  );

CREATE POLICY "Only Admin can delete services"
  ON public.services
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
        AND (
          'Admin' = ANY(employees.role) OR
          'Owner' = ANY(employees.role)
        )
    )
  );

-- 4. Drop the role_permission column
ALTER TABLE public.employees DROP COLUMN IF EXISTS role_permission;

-- 5. Update verify_employee_pin to not return role_permission
-- Must DROP first since we're changing the return type
DROP FUNCTION IF EXISTS public.verify_employee_pin(text);

CREATE FUNCTION public.verify_employee_pin(pin_input text)
RETURNS TABLE (
  employee_id uuid,
  display_name text,
  role text[],
  can_reset_pin boolean,
  store_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id as employee_id,
    e.display_name,
    e.role,
    e.can_reset_pin,
    NULL::uuid as store_id
  FROM employees e
  WHERE LOWER(e.status) = 'active'
    AND e.pin_code_hash IS NOT NULL
    AND e.pin_code_hash = extensions.crypt(pin_input, e.pin_code_hash)
  LIMIT 1;
END;
$$;

-- Note: The role_permission_type enum is kept for now as it may be used by
-- the role_permissions table (different from the column we just dropped).
-- The role_permissions table stores per-store permission settings per role.
