/*
  # Add Admin Role to Suppliers Policies

  ## Summary
  Update RLS policies to allow Admins, Managers, and Owners to create and update suppliers.

  ## Changes
  1. Policies Updated
    - "Managers can create suppliers" - Now includes Admin role
    - "Managers can update suppliers" - Now includes Admin role
  
  ## Security
  - Only authenticated users with Admin, Manager, or Owner role can create/update suppliers
  - All authenticated users can view suppliers (existing policy)
*/

-- Only update policies if suppliers table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
    RAISE NOTICE 'Skipping suppliers policies - table does not exist';
    RETURN;
  END IF;

  -- Drop existing policies
  DROP POLICY IF EXISTS "Managers can create suppliers" ON public.suppliers;
  DROP POLICY IF EXISTS "Managers can update suppliers" ON public.suppliers;

  -- Recreate INSERT policy with Admin role included
  EXECUTE $policy$
    CREATE POLICY "Managers can create suppliers"
      ON public.suppliers
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE employees.id = auth.uid()
          AND ('Admin' = ANY(employees.role) OR 'Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
        )
      )
  $policy$;

  -- Recreate UPDATE policy with Admin role included
  EXECUTE $policy$
    CREATE POLICY "Managers can update suppliers"
      ON public.suppliers
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE employees.id = auth.uid()
          AND ('Admin' = ANY(employees.role) OR 'Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE employees.id = auth.uid()
          AND ('Admin' = ANY(employees.role) OR 'Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
        )
      )
  $policy$;
END $$;
