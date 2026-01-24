/*
  # Update get_sorted_technicians_for_store for Small Service

  ## Overview
  Updates the get_sorted_technicians_for_store function to:
  1. Include 'small_service' as a queue status
  2. Calculate queue_position for both ready and small_service technicians
  3. Sort small_service with ready technicians (not at end with busy)

  ## Changes
  - queue_with_positions CTE: Includes all queue statuses, calculates position for ready+small_service
  - queue_status output: Returns 'small_service' when status is 'small_service'
  - ORDER BY: small_service sorts with ready (position 1), busy at end (position 3)
*/

DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid, text);

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
BEGIN
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
  employees_with_services AS (
    SELECT DISTINCT es.employee_id
    FROM public.employee_services es
  ),
  -- Include ALL queue statuses and calculate positions for ready + small_service
  queue_with_positions AS (
    SELECT
      trq.employee_id,
      trq.store_id,
      trq.status as queue_status_raw,
      trq.current_open_ticket_id,
      -- Calculate position only for ready and small_service (they share the same position pool)
      CASE
        WHEN trq.status IN ('ready', 'small_service') THEN
          ROW_NUMBER() OVER (
            PARTITION BY CASE WHEN trq.status IN ('ready', 'small_service') THEN 1 ELSE 0 END
            ORDER BY trq.ready_at ASC
          )
        ELSE NULL
      END as position
    FROM public.technician_ready_queue trq
    WHERE trq.store_id = p_store_id
  )
  SELECT
    e.id as employee_id,
    e.display_name,
    e.role,
    -- Use queue status field for proper status detection including small_service
    CASE
      WHEN q.queue_status_raw = 'small_service' THEN 'small_service'::text
      WHEN q.queue_status_raw = 'busy' THEN 'busy'::text
      WHEN ct.employee_id IS NOT NULL THEN 'busy'::text  -- Fallback for tickets without queue entry
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
  LEFT JOIN public.employee_stores es_filter ON es_filter.employee_id = e.id
  LEFT JOIN queue_with_positions q ON q.employee_id = e.id
  LEFT JOIN current_tickets ct ON ct.employee_id = e.id
  LEFT JOIN estimated_durations ed ON ed.employee_id = e.id
  INNER JOIN employees_with_services ews ON ews.employee_id = e.id
  WHERE
    (
      es_filter.store_id = p_store_id
      OR NOT EXISTS (
        SELECT 1 FROM public.employee_stores es_check
        WHERE es_check.employee_id = e.id
      )
    )
    AND (e.status = 'Active' OR e.status = 'active')
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
'Returns sorted technicians for the queue display. Includes small_service status for technicians doing small services while maintaining queue position. small_service technicians appear with their queue position alongside ready technicians.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
