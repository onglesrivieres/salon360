/*
  # Fix Stores RLS Policy for Role Array

  ## Problem
  The existing "Admins can manage stores" policy checks `employees.role_permission = 'Admin'`,
  but the `role_permission` column was removed from the employees table.
  This causes all UPDATE/INSERT/DELETE operations on stores to silently fail (return 0 rows).

  ## Impact
  - Store Operating Hours cannot be updated via the UI
  - StoreHoursEditor appears to save but doesn't persist changes
  - Receptionists get blocked based on outdated hours

  ## Solution
  Update the RLS policy to check the `role[]` array instead of the removed column.
*/

-- Drop existing broken policies that reference removed role_permission column
DROP POLICY IF EXISTS "Admins can manage stores" ON public.stores;
DROP POLICY IF EXISTS "Admin users can manage stores" ON public.stores;

-- Create new policy that checks the role[] array
CREATE POLICY "Admins can manage stores"
  ON public.stores FOR ALL
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND employees.status = 'Active'
      AND (
        'Admin' = ANY(employees.role) OR
        'Manager' = ANY(employees.role) OR
        'Owner' = ANY(employees.role)
      )
    )
  );

-- Add comment explaining the policy
COMMENT ON POLICY "Admins can manage stores" ON public.stores IS
  'Allows Admin, Manager, and Owner roles to manage stores (INSERT, UPDATE, DELETE).
   Checks the role[] array since the role_permission column was removed from employees table.';
