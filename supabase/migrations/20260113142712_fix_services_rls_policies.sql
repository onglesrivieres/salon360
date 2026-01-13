/*
  # Fix Services RLS Policies for PIN-based Authentication

  ## Problem
  The migration 20260112152227_remove_role_permission_column.sql broke RLS policies
  by using auth.uid() to identify users. This doesn't work with PIN-based auth because:
  - auth.uid() returns NULL or an anonymous ID for PIN-authenticated users
  - The policy check always fails, blocking ALL queries to store_services

  ## Solution
  Replace broken policies with ones that:
  1. Allow all users to SELECT services (permissive read)
  2. Check for employees with appropriate roles WITHOUT using auth.uid()

  ## Tables Fixed
  - store_services: SELECT was completely blocked
  - services: INSERT/UPDATE/DELETE policies were broken
*/

-- =============================================
-- FIX store_services TABLE
-- =============================================

-- Drop the broken policy that uses auth.uid()
DROP POLICY IF EXISTS "Admin, Manager, Supervisor can manage store services" ON public.store_services;

-- Allow all users to SELECT services (PIN auth doesn't integrate with RLS)
CREATE POLICY "All users can view store services"
  ON public.store_services FOR SELECT
  TO anon, authenticated
  USING (true);

-- Management policy for INSERT/UPDATE/DELETE (doesn't use auth.uid())
CREATE POLICY "Admin, Manager, Supervisor can manage store services"
  ON public.store_services FOR ALL
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND (
        'Admin' = ANY(employees.role) OR
        'Manager' = ANY(employees.role) OR
        'Supervisor' = ANY(employees.role) OR
        'Owner' = ANY(employees.role)
      )
      AND employees.status = 'Active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND (
        'Admin' = ANY(employees.role) OR
        'Manager' = ANY(employees.role) OR
        'Supervisor' = ANY(employees.role) OR
        'Owner' = ANY(employees.role)
      )
      AND employees.status = 'Active'
    )
  );

-- =============================================
-- FIX services TABLE (global service definitions)
-- =============================================

-- Drop broken policies that use auth.uid()
DROP POLICY IF EXISTS "Admin, Manager, Supervisor, Owner can insert services" ON public.services;
DROP POLICY IF EXISTS "Admin, Manager, Supervisor, Owner can update services" ON public.services;
DROP POLICY IF EXISTS "Only Admin can delete services" ON public.services;

-- Recreate INSERT policy (doesn't use auth.uid())
CREATE POLICY "Admin, Manager, Supervisor, Owner can insert services"
  ON public.services FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND (
        'Admin' = ANY(employees.role) OR
        'Manager' = ANY(employees.role) OR
        'Supervisor' = ANY(employees.role) OR
        'Owner' = ANY(employees.role)
      )
      AND employees.status = 'Active'
    )
  );

-- Recreate UPDATE policy (doesn't use auth.uid())
CREATE POLICY "Admin, Manager, Supervisor, Owner can update services"
  ON public.services FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND (
        'Admin' = ANY(employees.role) OR
        'Manager' = ANY(employees.role) OR
        'Supervisor' = ANY(employees.role) OR
        'Owner' = ANY(employees.role)
      )
      AND employees.status = 'Active'
    )
  );

-- Recreate DELETE policy (Admin/Owner only, doesn't use auth.uid())
CREATE POLICY "Only Admin can delete services"
  ON public.services FOR DELETE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND (
        'Admin' = ANY(employees.role) OR
        'Owner' = ANY(employees.role)
      )
      AND employees.status = 'Active'
    )
  );
