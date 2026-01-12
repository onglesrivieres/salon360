/*
  # Fix Queue Position Calculation Bug

  ## Problem
  The first person in the ready queue is showing as position #5 instead of #1.
  ROW_NUMBER() was counting ALL technicians including busy ones before the
  CASE filter was applied.

  ## Root Cause
  In the queue_with_positions CTE:
  ```sql
  CASE
    WHEN trq.status IN ('ready', 'small_service') THEN
      ROW_NUMBER() OVER (ORDER BY trq.ready_at ASC)  -- Counts ALL rows!
    ELSE NULL
  END as position
  ```

  This calculates ROW_NUMBER for ALL rows, then only shows it for ready/small_service.
  If 4 are busy and 1 is ready, the ready one gets position #5.

  ## Solution
  Split into two CTEs:
  1. ready_positions - Calculate positions for ONLY ready/small_service (filter BEFORE ROW_NUMBER)
  2. all_queue_status - Get status for ALL technicians (for busy detection)
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
  -- FIX: Calculate positions for ONLY ready/small_service (filter BEFORE ROW_NUMBER)
  ready_positions AS (
    SELECT
      trq.employee_id,
      ROW_NUMBER() OVER (ORDER BY trq.ready_at ASC) as position
    FROM public.technician_ready_queue trq
    WHERE trq.store_id = p_store_id
      AND trq.status IN ('ready', 'small_service')  -- Only count ready/small_service
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
    -- Queue status with small_service support
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
    -- Status filter: must be active
    LOWER(e.status) = 'active'
    -- Role filter: must be Technician, Supervisor, or Spa Expert
    AND (
      e.role @> ARRAY['Technician']::text[]
      OR e.role @> ARRAY['Supervisor']::text[]
      OR e.role @> ARRAY['Spa Expert']::text[]
    )
    -- Exclude Cashiers
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
'Returns sorted technicians for queue display. Positions are calculated for ready/small_service only (not busy). Filters by role (Technician/Supervisor/Spa Expert, NOT Cashier), schedule (weekly_schedule OR checked_in), and store assignment.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
