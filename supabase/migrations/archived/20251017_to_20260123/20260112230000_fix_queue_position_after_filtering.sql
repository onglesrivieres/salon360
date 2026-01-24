/*
  # Fix Queue Position - Calculate After Filtering

  ## Problem
  Positions were calculated in ready_positions CTE for ALL technicians in the queue,
  but the main query filters some out (not scheduled, wrong role, etc.).
  This creates gaps - position #1 could go to a filtered-out technician,
  so the first visible technician shows #2.

  ## Solution
  Calculate positions AFTER the main filtering using a subquery approach:
  1. First, get all filtered technicians with their raw data
  2. Then calculate positions only for the visible ready/small_service technicians
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
  WITH
  -- Get employees with open tickets (for status determination)
  employees_with_open_tickets AS (
    SELECT DISTINCT ti.employee_id
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
  ),
  -- Get ticket details for display
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
  -- Get estimated durations
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
  -- Get queue status for all technicians
  all_queue_status AS (
    SELECT
      trq.employee_id,
      trq.status as queue_status_raw,
      trq.ready_at,
      trq.current_open_ticket_id
    FROM public.technician_ready_queue trq
    WHERE trq.store_id = p_store_id
  ),
  -- First, get all FILTERED technicians with their calculated queue_status
  filtered_technicians AS (
    SELECT
      e.id as employee_id,
      e.display_name,
      e.role,
      -- Calculate display status
      CASE
        WHEN qs.queue_status_raw = 'small_service' THEN 'small_service'::text
        WHEN qs.queue_status_raw = 'busy' THEN 'busy'::text
        WHEN ct.employee_id IS NOT NULL THEN 'busy'::text
        WHEN qs.queue_status_raw = 'ready' THEN 'ready'::text
        ELSE 'neutral'::text
      END as queue_status,
      qs.ready_at,
      COALESCE(qs.current_open_ticket_id, ct.ticket_id) as current_ticket_id,
      ct.customer_name as ticket_customer_name,
      ct.start_time as ticket_start_time,
      ed.total_estimated_min::integer as estimated_duration_min,
      ct.elapsed_min::integer as time_elapsed_min,
      GREATEST(0, COALESCE(ed.total_estimated_min, 0) - COALESCE(ct.elapsed_min, 0))::integer as time_remaining_min
    FROM public.employees e
    LEFT JOIN all_queue_status qs ON qs.employee_id = e.id
    LEFT JOIN current_tickets ct ON ct.employee_id = e.id
    LEFT JOIN estimated_durations ed ON ed.employee_id = e.id
    WHERE
      -- Apply ALL filters here
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
  )
  -- Now calculate positions ONLY for visible ready/small_service technicians
  SELECT
    ft.employee_id,
    ft.display_name,
    ft.role,
    ft.queue_status,
    -- Calculate position only for ready/small_service, NULL for others
    CASE
      WHEN ft.queue_status IN ('ready', 'small_service') THEN
        ROW_NUMBER() OVER (
          PARTITION BY (ft.queue_status IN ('ready', 'small_service'))
          ORDER BY ft.ready_at ASC NULLS LAST
        )::integer
      ELSE NULL
    END as queue_position,
    ft.current_ticket_id,
    ft.ticket_customer_name,
    ft.ticket_start_time,
    ft.estimated_duration_min,
    ft.time_elapsed_min,
    ft.time_remaining_min
  FROM filtered_technicians ft
  ORDER BY
    -- Ready/small_service first, then neutral, then busy
    CASE
      WHEN ft.queue_status IN ('ready', 'small_service') THEN 1
      WHEN ft.queue_status = 'neutral' THEN 2
      ELSE 3
    END,
    -- Within ready/small_service, order by ready_at
    ft.ready_at ASC NULLS LAST,
    ft.display_name;
END;
$$;

COMMENT ON FUNCTION public.get_sorted_technicians_for_store(uuid, text) IS
'Returns sorted technicians for queue display. Positions are calculated AFTER filtering to ensure sequential numbering for visible technicians only.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
