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

-- Only create policies if suppliers table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
    RAISE NOTICE 'Skipping suppliers policies - table does not exist';
    RETURN;
  END IF;

  -- Allow Managers and Owners to create suppliers
  EXECUTE $policy$
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
      )
  $policy$;

  -- Allow Managers and Owners to update suppliers
  EXECUTE $policy$
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
      )
  $policy$;
END $$;
