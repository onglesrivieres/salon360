/*
  # Fix Employee Services RLS for PIN Authentication

  1. Changes
    - Drop existing INSERT and DELETE policies that check auth.uid()
    - Create new permissive policies for anon users
    - PIN authentication means users are in anon role, not authenticated
    - Application-level security through PIN verification handles access control
  
  2. Security Notes
    - Follows same pattern as other tables in the system (employees, stores, etc.)
    - PIN authentication is verified at application level
    - Anon users can modify employee services (managers/supervisors verified by PIN)
*/

-- Drop the restrictive policies
DROP POLICY IF EXISTS "Managers and supervisors can insert employee services" ON public.employee_services;
DROP POLICY IF EXISTS "Managers and supervisors can delete employee services" ON public.employee_services;

-- Create permissive policies for anon users (PIN authentication)
CREATE POLICY "Allow anon insert employee services"
  ON public.employee_services
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon delete employee services"
  ON public.employee_services
  FOR DELETE
  TO anon
  USING (true);

-- Keep authenticated policies for completeness (if JWT auth is ever used)
CREATE POLICY "Allow authenticated insert employee services"
  ON public.employee_services
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete employee services"
  ON public.employee_services
  FOR DELETE
  TO authenticated
  USING (true);