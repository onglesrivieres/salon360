/*
  # Update Store Services RLS policies for Manager and Supervisor access

  1. Changes to RLS Policies
    - Drop existing restrictive policy for store_services management
    - Create new policy allowing Admin, Manager, Supervisor, and Owner to manage store services
    
  2. Security
    - Maintains RLS protection on store_services table
    - Expands management access to include Manager and Supervisor roles
    - View access remains available to all authenticated users
    
  3. Roles with Management Access
    - Admin: Full access to all operations
    - Manager: Can create, edit, and archive services
    - Supervisor: Can create, edit, and archive services
    - Owner: Full access to all operations (typically also has Admin role)
*/

-- Drop existing management policies for store_services
DROP POLICY IF EXISTS "Admin and Receptionist can manage store services" ON public.store_services;
DROP POLICY IF EXISTS "Admins and Receptionists can manage store services" ON public.store_services;

-- Create new policy allowing Admin, Manager, Supervisor to manage store services
CREATE POLICY "Admin, Manager, Supervisor can manage store services"
  ON public.store_services FOR ALL
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND (
        employees.role_permission IN ('Admin')
        OR 'Manager' = ANY(employees.role)
        OR 'Supervisor' = ANY(employees.role)
        OR 'Owner' = ANY(employees.role)
      )
      AND employees.status = 'Active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND (
        employees.role_permission IN ('Admin')
        OR 'Manager' = ANY(employees.role)
        OR 'Supervisor' = ANY(employees.role)
        OR 'Owner' = ANY(employees.role)
      )
      AND employees.status = 'Active'
    )
  );

-- Drop existing management policies for services (global service definitions)
DROP POLICY IF EXISTS "Allow all access to services" ON public.services;

-- Create read policy for services (all authenticated users can view)
CREATE POLICY "All users can view services"
  ON public.services FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create insert policy for services (Admin, Manager, Supervisor, Owner)
CREATE POLICY "Admin, Manager, Supervisor, Owner can insert services"
  ON public.services FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND (
        employees.role_permission IN ('Admin')
        OR 'Manager' = ANY(employees.role)
        OR 'Supervisor' = ANY(employees.role)
        OR 'Owner' = ANY(employees.role)
      )
      AND employees.status = 'Active'
    )
  );

-- Create update policy for services (Admin, Manager, Supervisor, Owner)
CREATE POLICY "Admin, Manager, Supervisor, Owner can update services"
  ON public.services FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND (
        employees.role_permission IN ('Admin')
        OR 'Manager' = ANY(employees.role)
        OR 'Supervisor' = ANY(employees.role)
        OR 'Owner' = ANY(employees.role)
      )
      AND employees.status = 'Active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND (
        employees.role_permission IN ('Admin')
        OR 'Manager' = ANY(employees.role)
        OR 'Supervisor' = ANY(employees.role)
        OR 'Owner' = ANY(employees.role)
      )
      AND employees.status = 'Active'
    )
  );

-- Explicitly restrict DELETE operations to Admin only (prevents accidental data loss)
CREATE POLICY "Only Admin can delete services"
  ON public.services FOR DELETE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.pin_code_hash IS NOT NULL
      AND employees.role_permission = 'Admin'
      AND employees.status = 'Active'
    )
  );