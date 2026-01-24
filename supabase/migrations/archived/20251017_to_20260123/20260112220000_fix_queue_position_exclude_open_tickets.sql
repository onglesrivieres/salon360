/*
  # Fix Queue Position - Exclude Technicians with Open Tickets

  ## Problem
  Position calculation uses `technician_ready_queue.status`, but a technician can have
  status='ready' while having an open ticket (if trigger didn't fire or data is stale).
  This causes the first visible "ready" technician to show position #2+ instead of #1.

  ## Example Scenario
  - Tech A: queue status='ready', has open ticket → displayed as 'busy' but gets position #1
  - Tech B: queue status='ready', no open ticket → displayed as 'ready' but gets position #2
  Result: First ready technician shows #2, not #1

  ## Solution
  Update `ready_positions` CTE to exclude technicians who have open tickets.
  This ensures positions are only assigned to technicians who are truly available.
*/

-- Drop ALL versions of the function
DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid, text);
DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid, date);
DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid);

CREATE OR REPLACE FUNCTION public.get_sorted_technicians_for_store(
  p_store_id uuid,
  p_date text
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
  -- Get employees with open tickets (one row per employee)
  WITH employees_with_open_tickets AS (
    SELECT DISTINCT ti.employee_id
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
  ),
  -- Get ticket details for display (one row per employee)
  current_tickets AS (
    SELECT DISTINCT ON (ti.employee_id)
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
    ORDER BY ti.employee_id, st.opened_at ASC
  ),
  -- Use store_services for duration
  estimated_durations AS (
    SELECT
      ti.employee_id,
      SUM(COALESCE(ss.duration_min, 0)) as total_estimated_min
    FROM public.ticket_items ti
    LEFT JOIN public.store_services ss ON ss.id = ti.store_service_id
    JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
    GROUP BY ti.employee_id
  ),
  -- FIX: Calculate positions for truly available technicians only
  -- Must be 'ready' or 'small_service' AND NOT have any open tickets (unless small_service)
  ready_positions AS (
    SELECT
      trq.employee_id,
      ROW_NUMBER() OVER (ORDER BY trq.ready_at ASC) as position
    FROM public.technician_ready_queue trq
    WHERE trq.store_id = p_store_id
      AND (
        -- small_service keeps position even with open ticket
        trq.status = 'small_service'
        OR (
          -- ready must not have open tickets
          trq.status = 'ready'
          AND NOT EXISTS (
            SELECT 1 FROM employees_with_open_tickets eot
            WHERE eot.employee_id = trq.employee_id
          )
        )
      )
  ),
  -- Get status for ALL technicians in queue (including busy)
  all_queue_status AS (
    SELECT
      trq.employee_id,
      trq.status as queue_status_raw,
      trq.current_open_ticket_id
    FROM public.technician_ready_queue trq
    WHERE trq.store_id = p_store_id
  )
  SELECT
    e.id as employee_id,
    e.display_name,
    e.role,
    CASE
      WHEN qs.queue_status_raw = 'small_service' THEN 'small_service'::text
      WHEN qs.queue_status_raw = 'busy' THEN 'busy'::text
      WHEN ct.employee_id IS NOT NULL THEN 'busy'::text
      WHEN qs.queue_status_raw = 'ready' THEN 'ready'::text
      ELSE 'neutral'::text
    END as queue_status,
    rp.position::integer as queue_position,
    COALESCE(qs.current_open_ticket_id, ct.ticket_id) as current_ticket_id,
    ct.customer_name as ticket_customer_name,
    ct.start_time as ticket_start_time,
    ed.total_estimated_min::integer as estimated_duration_min,
    ct.elapsed_min::integer as time_elapsed_min,
    GREATEST(0, COALESCE(ed.total_estimated_min, 0) - COALESCE(ct.elapsed_min, 0))::integer as time_remaining_min
  FROM public.employees e
  LEFT JOIN ready_positions rp ON rp.employee_id = e.id
  LEFT JOIN all_queue_status qs ON qs.employee_id = e.id
  LEFT JOIN current_tickets ct ON ct.employee_id = e.id
  LEFT JOIN estimated_durations ed ON ed.employee_id = e.id
  WHERE
    LOWER(e.status) = 'active'
    AND (
      e.role @> ARRAY['Technician']::text[]
      OR e.role @> ARRAY['Supervisor']::text[]
      OR e.role @> ARRAY['Spa Expert']::text[]
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
        AND ar.work_date = p_date::date
        AND ar.status = 'checked_in'
      )
    )
  ORDER BY
    CASE
      WHEN qs.queue_status_raw = 'small_service' THEN 1
      WHEN qs.queue_status_raw = 'ready' THEN 1
      WHEN qs.queue_status_raw = 'busy' OR ct.employee_id IS NOT NULL THEN 3
      ELSE 2
    END,
    rp.position NULLS LAST,
    e.display_name;
END;
$$;

COMMENT ON FUNCTION public.get_sorted_technicians_for_store(uuid, text) IS
'Returns sorted technicians for queue display. Positions are only assigned to truly available technicians (ready without open tickets, or small_service). Excludes technicians with stale ready status who have open tickets.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
