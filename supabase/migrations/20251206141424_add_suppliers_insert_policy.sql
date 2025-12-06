/*
  # Add Suppliers Insert and Update Policies
  
  ## Summary
  Add RLS policies to allow Managers and Owners to create and update suppliers.
  
  ## Changes
  1. Policies Added
    - "Managers can create suppliers" - Allows Managers and Owners to insert new suppliers
    - "Managers can update suppliers" - Allows Managers and Owners to update existing suppliers
  
  ## Security
  - Only authenticated users with Manager or Owner role can create/update suppliers
  - All authenticated users can view suppliers (existing policy)
*/

-- Allow Managers and Owners to create suppliers
CREATE POLICY "Managers can create suppliers"
  ON public.suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
      AND ('Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
    )
  );

-- Allow Managers and Owners to update suppliers
CREATE POLICY "Managers can update suppliers"
  ON public.suppliers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
      AND ('Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
      AND ('Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
    )
  );
