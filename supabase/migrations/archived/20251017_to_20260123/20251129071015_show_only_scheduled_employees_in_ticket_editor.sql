/*
  # Show Only Scheduled Employees in Ticket Editor

  ## Summary
  Updates the `get_sorted_technicians_for_store` function to only show employees
  who are explicitly scheduled for today or have checked in.

  ## Problem
  Currently, employees with no schedule configured (weekly_schedule IS NULL) are
  automatically shown in the Ticket Editor, treating "no schedule" as "works every day".
  This prevents proper schedule enforcement.

  ## Solution
  Remove the automatic inclusion of employees with no schedule. Employees will appear if:
  1. They are scheduled for today (weekly_schedule shows is_working: true), OR
  2. They are checked in today (attendance_records shows checked_in status)

  This enforces stricter scheduling while allowing flexibility for employees who
  show up and check in.

  ## Changes
  1. Remove `e.weekly_schedule IS NULL` condition from queue_positions CTE
  2. Remove `e.weekly_schedule IS NULL` condition from main SELECT WHERE clause
  3. Keep check-in override logic intact
*/

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid, DATE);

-- Recreate with updated schedule filtering
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
  -- Calculate day of week from provided date
  -- PostgreSQL EXTRACT(DOW) returns: 0=Sunday, 1=Monday, ..., 6=Saturday
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
      SUM(s.duration_min * ti.qty) as total_duration_min
    FROM public.ticket_items ti
    JOIN public.sale_tickets st ON ti.sale_ticket_id = st.id
    JOIN public.services s ON ti.service_id = s.id
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
      AND (e.role @> ARRAY['Technician']::text[] OR e.role @> ARRAY['Supervisor']::text[] OR e.role @> ARRAY['Spa Expert']::text[])
      AND NOT e.role @> ARRAY['Cashier']::text[]
      AND EXISTS (
        SELECT 1 FROM public.employee_stores es
        WHERE es.employee_id = e.id
        AND es.store_id = p_store_id
      )
      -- Only include if: scheduled for today OR checked in today
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
      WHEN eot.oldest_ticket_at IS NOT NULL AND eot.total_duration_min IS NOT NULL
      THEN eot.oldest_ticket_at + (eot.total_duration_min || ' minutes')::interval
      ELSE NULL
    END as estimated_completion_time
  FROM public.employees e
  LEFT JOIN queue_positions qp ON e.id = qp.employee_id
  LEFT JOIN employee_open_tickets eot ON e.id = eot.employee_id
  WHERE LOWER(e.status) = 'active'
    AND (e.role @> ARRAY['Technician']::text[] OR e.role @> ARRAY['Supervisor']::text[] OR e.role @> ARRAY['Spa Expert']::text[])
    AND NOT e.role @> ARRAY['Cashier']::text[]
    AND EXISTS (
      SELECT 1 FROM public.employee_stores es
      WHERE es.employee_id = e.id
      AND es.store_id = p_store_id
    )
    -- Only include if: scheduled for today OR checked in today
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

-- Reload schema
NOTIFY pgrst, 'reload schema';