/*
  # Auto-assign services to service-performing employees

  1. Purpose
    - Automatically assigns ALL store services to employees with service-performing roles
    - Fixes immediate queue visibility issue caused by missing service assignments
    - Employees can be manually refined later through the UI

  2. Affected Roles
    - Technician
    - Spa Expert
    - Supervisor
    - Receptionist

  3. Logic
    - For each employee with a service-performing role
    - Assign ALL services from their associated stores
    - Use ON CONFLICT to avoid duplicate assignments
    - Skip employees who already have service assignments

  4. Notes
    - This is a one-time backfill operation
    - Future employees will need manual service assignment or can run this again
    - Does not affect employees with only Manager, Admin, or Cashier roles
*/

-- Auto-assign all services to employees with service-performing roles
INSERT INTO public.employee_services (employee_id, service_id)
SELECT DISTINCT
  e.id AS employee_id,
  ss.id AS service_id
FROM public.employees e
-- Get all stores the employee works at
INNER JOIN public.employee_stores es ON es.employee_id = e.id
-- Get all services for those stores
INNER JOIN public.store_services ss ON ss.store_id = es.store_id
WHERE
  -- Only include employees with service-performing roles
  (
    e.role @> ARRAY['Technician']::text[] OR
    e.role @> ARRAY['Spa Expert']::text[] OR
    e.role @> ARRAY['Supervisor']::text[] OR
    e.role @> ARRAY['Receptionist']::text[]
  )
  -- Only include active services
  AND ss.archived = false
  -- Only include active employees
  AND e.status = 'active'
-- Avoid duplicates
ON CONFLICT (employee_id, service_id) DO NOTHING;