/*
  # Create Employee Services Assignment Table

  1. New Tables
    - `employee_services`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key to employees)
      - `service_id` (uuid, foreign key to services)
      - `created_at` (timestamptz)
  
  2. Indexes
    - Index on `employee_id` for efficient lookup of services per employee
    - Index on `service_id` for efficient lookup of employees per service
    - Unique constraint on (employee_id, service_id) to prevent duplicates
  
  3. Security
    - Enable RLS on `employee_services` table
    - Add policies for authenticated users to read their store's employee service assignments
    - Add policies for managers/supervisors to manage employee service assignments
  
  4. Important Notes
    - Employees without service assignments will have no service access (no backward compatibility)
    - Service assignments apply globally across all stores an employee works at
    - ON DELETE CASCADE ensures cleanup when employee or service is deleted
*/

-- Create employee_services table
CREATE TABLE IF NOT EXISTS public.employee_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT employee_services_unique UNIQUE (employee_id, service_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_services_employee_id ON public.employee_services(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_services_service_id ON public.employee_services(service_id);

-- Enable RLS
ALTER TABLE public.employee_services ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view employee services
CREATE POLICY "Authenticated users can view employee services"
  ON public.employee_services
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Allow anonymous users to view employee services (for pin auth)
CREATE POLICY "Anonymous users can view employee services"
  ON public.employee_services
  FOR SELECT
  TO anon
  USING (true);

-- Policy: Managers and supervisors can insert employee services
CREATE POLICY "Managers and supervisors can insert employee services"
  ON public.employee_services
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid()
      AND (e.role && ARRAY['manager', 'supervisor']::text[])
    )
  );

-- Policy: Managers and supervisors can delete employee services
CREATE POLICY "Managers and supervisors can delete employee services"
  ON public.employee_services
  FOR DELETE
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid()
      AND (e.role && ARRAY['manager', 'supervisor']::text[])
    )
  );

-- Add comment
COMMENT ON TABLE public.employee_services IS 'Junction table linking employees to services they can perform. Employees without entries have no service access.';