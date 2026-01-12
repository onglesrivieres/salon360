/*
  # Update Service Performer Roles and Remove Spa Expert

  ## Summary
  Updates role-based access for services and queue visibility:
  1. Remove Spa Expert role from the application entirely
  2. Technician/Supervisor/Manager/Owner can perform ALL services and appear in queue (if scheduled)
  3. Receptionist/Cashier/Admin cannot perform services or appear in queue

  ## Changes:
  1. Migrate Spa Expert employees to Technician role
  2. Remove Spa Expert from valid roles constraint
  3. Update queue function to include Manager/Owner, exclude Spa Expert
  4. Update service assignments (remove Receptionist, add Manager/Owner)
  5. Clear weekly schedule for Admin employees (uncheck all days)
*/

-- ============================================================================
-- STEP 1: MIGRATE SPA EXPERT EMPLOYEES TO TECHNICIAN
-- ============================================================================

-- Replace 'Spa Expert' with 'Technician' in employee role arrays
UPDATE public.employees
SET role = array_replace(role, 'Spa Expert', 'Technician')
WHERE role @> ARRAY['Spa Expert']::text[];

-- ============================================================================
-- STEP 2: UPDATE ROLE CONSTRAINT (Remove Spa Expert)
-- ============================================================================

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_valid;
ALTER TABLE public.employees ADD CONSTRAINT employees_role_valid
  CHECK (role <@ ARRAY['Technician', 'Receptionist', 'Manager', 'Owner', 'Supervisor', 'Cashier', 'Admin']::text[]);

-- ============================================================================
-- STEP 3: UPDATE QUEUE FUNCTION
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid, DATE);

CREATE FUNCTION public.get_sorted_technicians_for_store(
  p_store_id uuid,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  employee_id uuid,
  legal_name text,
  display_name text,
  queue_status text,
  queue_position integer,
  ready_at timestamptz,
  current_open_ticket_id uuid,
  open_ticket_count integer,
  ticket_start_time timestamptz,
  estimated_duration_min integer,
  estimated_completion_time timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_day_name text;
BEGIN
  v_day_name := CASE EXTRACT(DOW FROM p_date)::integer
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END;

  RETURN QUERY
  WITH employee_open_tickets AS (
    SELECT
      ti.employee_id,
      COUNT(DISTINCT st.id) as ticket_count,
      MIN(st.opened_at) as oldest_ticket_at,
      (array_agg(st.id ORDER BY st.opened_at ASC))[1] as oldest_ticket_id,
      SUM(COALESCE(ss.duration_min, 0) * ti.qty) as total_duration_min
    FROM public.ticket_items ti
    JOIN public.sale_tickets st ON ti.sale_ticket_id = st.id
    LEFT JOIN public.store_services ss ON ti.store_service_id = ss.id
    WHERE st.closed_at IS NULL
      AND st.completed_at IS NULL
      AND st.store_id = p_store_id
    GROUP BY ti.employee_id
  ),
  queue_positions AS (
    SELECT
      trq.employee_id,
      trq.status,
      trq.ready_at,
      trq.current_open_ticket_id,
      ROW_NUMBER() OVER (ORDER BY trq.ready_at ASC) as position
    FROM public.technician_ready_queue trq
    JOIN public.employees e ON trq.employee_id = e.id
    WHERE trq.store_id = p_store_id
      AND trq.status = 'ready'
      AND LOWER(e.status) = 'active'
      -- Service performer roles: Technician, Supervisor, Manager, Owner
      AND (
        e.role @> ARRAY['Technician']::text[]
        OR e.role @> ARRAY['Supervisor']::text[]
        OR e.role @> ARRAY['Manager']::text[]
        OR e.role @> ARRAY['Owner']::text[]
      )
      AND NOT e.role @> ARRAY['Cashier']::text[]
      AND EXISTS (
        SELECT 1 FROM public.employee_stores es
        WHERE es.employee_id = e.id AND es.store_id = p_store_id
      )
      AND (
        COALESCE((e.weekly_schedule->v_day_name->>'is_working')::boolean, false) = true
        OR EXISTS (
          SELECT 1 FROM public.attendance_records ar
          WHERE ar.employee_id = e.id
          AND ar.store_id = p_store_id
          AND ar.work_date = p_date
          AND ar.status = 'checked_in'
        )
      )
  )
  SELECT
    e.id as employee_id,
    e.legal_name,
    e.display_name,
    CASE
      WHEN eot.ticket_count > 0 THEN 'busy'
      WHEN qp.employee_id IS NOT NULL AND qp.status = 'ready' THEN 'ready'
      ELSE 'neutral'
    END as queue_status,
    COALESCE(qp.position::integer, 0) as queue_position,
    qp.ready_at,
    COALESCE(eot.oldest_ticket_id, qp.current_open_ticket_id) as current_open_ticket_id,
    COALESCE(eot.ticket_count::integer, 0) as open_ticket_count,
    eot.oldest_ticket_at as ticket_start_time,
    COALESCE(eot.total_duration_min::integer, 0) as estimated_duration_min,
    CASE
      WHEN eot.oldest_ticket_at IS NOT NULL AND eot.total_duration_min > 0
      THEN eot.oldest_ticket_at + (eot.total_duration_min || ' minutes')::interval
      ELSE NULL
    END as estimated_completion_time
  FROM public.employees e
  LEFT JOIN queue_positions qp ON e.id = qp.employee_id
  LEFT JOIN employee_open_tickets eot ON e.id = eot.employee_id
  WHERE LOWER(e.status) = 'active'
    -- Service performer roles: Technician, Supervisor, Manager, Owner
    AND (
      e.role @> ARRAY['Technician']::text[]
      OR e.role @> ARRAY['Supervisor']::text[]
      OR e.role @> ARRAY['Manager']::text[]
      OR e.role @> ARRAY['Owner']::text[]
    )
    AND NOT e.role @> ARRAY['Cashier']::text[]
    AND EXISTS (
      SELECT 1 FROM public.employee_stores es
      WHERE es.employee_id = e.id AND es.store_id = p_store_id
    )
    AND (
      COALESCE((e.weekly_schedule->v_day_name->>'is_working')::boolean, false) = true
      OR EXISTS (
        SELECT 1 FROM public.attendance_records ar
        WHERE ar.employee_id = e.id
        AND ar.store_id = p_store_id
        AND ar.work_date = p_date
        AND ar.status = 'checked_in'
      )
    )
  ORDER BY
    CASE
      WHEN eot.ticket_count > 0 THEN 3
      WHEN qp.employee_id IS NOT NULL AND qp.status = 'ready' THEN 1
      ELSE 2
    END,
    qp.position,
    e.display_name;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION public.get_sorted_technicians_for_store(uuid, DATE) IS
'Returns sorted technicians for the Ticket Editor queue display. Uses role-based filtering (Technician, Supervisor, Manager, Owner) with schedule-based filtering.';

-- ============================================================================
-- STEP 4: UPDATE SERVICE ASSIGNMENTS
-- ============================================================================

-- Remove service assignments for Receptionist-only employees
DELETE FROM public.employee_services
WHERE employee_id IN (
  SELECT e.id FROM public.employees e
  WHERE e.role @> ARRAY['Receptionist']::text[]
    AND NOT e.role @> ARRAY['Technician']::text[]
    AND NOT e.role @> ARRAY['Supervisor']::text[]
    AND NOT e.role @> ARRAY['Manager']::text[]
    AND NOT e.role @> ARRAY['Owner']::text[]
);

-- Add all services to Manager and Owner employees
INSERT INTO public.employee_services (employee_id, service_id)
SELECT DISTINCT e.id, ss.id
FROM public.employees e
INNER JOIN public.employee_stores es ON es.employee_id = e.id
INNER JOIN public.store_services ss ON ss.store_id = es.store_id
WHERE (
  e.role @> ARRAY['Manager']::text[] OR
  e.role @> ARRAY['Owner']::text[]
)
AND ss.archived = false
AND e.status = 'active'
ON CONFLICT (employee_id, service_id) DO NOTHING;

-- ============================================================================
-- STEP 5: CLEAR WEEKLY SCHEDULE FOR ADMIN EMPLOYEES
-- ============================================================================

-- Admin employees should not appear in the queue, so clear their weekly schedule
UPDATE public.employees
SET weekly_schedule = jsonb_build_object(
  'monday', jsonb_build_object('is_working', false, 'start_time', '09:00', 'end_time', '18:00'),
  'tuesday', jsonb_build_object('is_working', false, 'start_time', '09:00', 'end_time', '18:00'),
  'wednesday', jsonb_build_object('is_working', false, 'start_time', '09:00', 'end_time', '18:00'),
  'thursday', jsonb_build_object('is_working', false, 'start_time', '09:00', 'end_time', '18:00'),
  'friday', jsonb_build_object('is_working', false, 'start_time', '09:00', 'end_time', '18:00'),
  'saturday', jsonb_build_object('is_working', false, 'start_time', '09:00', 'end_time', '18:00'),
  'sunday', jsonb_build_object('is_working', false, 'start_time', '09:00', 'end_time', '18:00')
)
WHERE role @> ARRAY['Admin']::text[];

-- ============================================================================
-- RELOAD SCHEMA
-- ============================================================================

NOTIFY pgrst, 'reload schema';
