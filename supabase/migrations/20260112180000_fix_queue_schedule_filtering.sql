/*
  # Fix Queue Schedule and Role Filtering

  ## Problem
  The get_sorted_technicians_for_store function is showing all employees
  instead of only those scheduled to work today. Missing filtering:
  1. Weekly schedule filtering
  2. Role-based filtering (Technician, Supervisor, Spa Expert)
  3. Cashier exclusion
  4. Check-in override logic

  ## Root Cause
  When fixing the function overload conflict (PGRST203 error), the function
  was recreated without the original filtering logic from migration
  20260105191919_restore_role_based_technician_function.sql.

  ## Solution
  Restore the filtering while keeping small_service support from recent feature.
*/

-- Drop ALL versions of the function
DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid, text);
DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid, date);
DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid);

CREATE OR REPLACE FUNCTION public.get_sorted_technicians_for_store(
  p_store_id uuid,
  p_date text  -- Frontend passes string dates like "2026-01-12"
)
RETURNS TABLE (
  employee_id uuid,
  display_name text,
  role text[],
  queue_status text,
  queue_position integer,
  current_ticket_id uuid,
  ticket_customer_name text,
  ticket_start_time timestamptz,
  estimated_duration_min integer,
  time_elapsed_min integer,
  time_remaining_min integer
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
  v_day_name := CASE EXTRACT(DOW FROM p_date::date)::integer
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END;

  RETURN QUERY
  WITH current_tickets AS (
    SELECT
      ti.employee_id,
      st.id as ticket_id,
      st.customer_name,
      st.opened_at as start_time,
      EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - st.opened_at))/60 as elapsed_min
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
  ),
  estimated_durations AS (
    SELECT
      ti.employee_id,
      SUM(s.duration_min) as total_estimated_min
    FROM public.ticket_items ti
    JOIN public.services s ON s.id = ti.service_id
    JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
    GROUP BY ti.employee_id
  ),
  -- Calculate positions for ready + small_service technicians
  queue_with_positions AS (
    SELECT
      trq.employee_id,
      trq.store_id,
      trq.status as queue_status_raw,
      trq.current_open_ticket_id,
      CASE
        WHEN trq.status IN ('ready', 'small_service') THEN
          ROW_NUMBER() OVER (ORDER BY trq.ready_at ASC)
        ELSE NULL
      END as position
    FROM public.technician_ready_queue trq
    WHERE trq.store_id = p_store_id
  )
  SELECT
    e.id as employee_id,
    e.display_name,
    e.role,
    -- Queue status with small_service support
    CASE
      WHEN q.queue_status_raw = 'small_service' THEN 'small_service'::text
      WHEN q.queue_status_raw = 'busy' THEN 'busy'::text
      WHEN ct.employee_id IS NOT NULL THEN 'busy'::text
      WHEN q.queue_status_raw = 'ready' THEN 'ready'::text
      ELSE 'neutral'::text
    END as queue_status,
    q.position::integer as queue_position,
    COALESCE(q.current_open_ticket_id, ct.ticket_id) as current_ticket_id,
    ct.customer_name as ticket_customer_name,
    ct.start_time as ticket_start_time,
    ed.total_estimated_min::integer as estimated_duration_min,
    ct.elapsed_min::integer as time_elapsed_min,
    GREATEST(0, COALESCE(ed.total_estimated_min, 0) - COALESCE(ct.elapsed_min, 0))::integer as time_remaining_min
  FROM public.employees e
  LEFT JOIN queue_with_positions q ON q.employee_id = e.id
  LEFT JOIN current_tickets ct ON ct.employee_id = e.id
  LEFT JOIN estimated_durations ed ON ed.employee_id = e.id
  WHERE
    -- Status filter: must be active
    LOWER(e.status) = 'active'
    -- Role filter: must be Technician, Supervisor, or Spa Expert
    AND (
      e.role @> ARRAY['Technician']::text[]
      OR e.role @> ARRAY['Supervisor']::text[]
      OR e.role @> ARRAY['Spa Expert']::text[]
    )
    -- Exclude Cashiers (even if they have other qualifying roles)
    AND NOT e.role @> ARRAY['Cashier']::text[]
    -- Store filter: must be assigned to this store
    AND EXISTS (
      SELECT 1 FROM public.employee_stores es
      WHERE es.employee_id = e.id
      AND es.store_id = p_store_id
    )
    -- Schedule filter: scheduled for today OR checked in today
    AND (
      COALESCE((e.weekly_schedule->v_day_name->>'is_working')::boolean, false) = true
      OR EXISTS (
        SELECT 1 FROM public.attendance_records ar
        WHERE ar.employee_id = e.id
        AND ar.store_id = p_store_id
        AND ar.work_date = p_date::date
        AND ar.status = 'checked_in'
      )
    )
  ORDER BY
    -- small_service sorts with ready (position 1), busy at end (position 3)
    CASE
      WHEN q.queue_status_raw = 'small_service' THEN 1
      WHEN q.queue_status_raw = 'ready' THEN 1
      WHEN q.queue_status_raw = 'busy' OR ct.employee_id IS NOT NULL THEN 3
      ELSE 2
    END,
    q.position NULLS LAST,
    e.display_name;
END;
$$;

COMMENT ON FUNCTION public.get_sorted_technicians_for_store(uuid, text) IS
'Returns sorted technicians for queue display. Filters by: role (Technician/Supervisor/Spa Expert, NOT Cashier), schedule (weekly_schedule OR checked_in attendance), and store assignment. Supports small_service status for queue position preservation.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
