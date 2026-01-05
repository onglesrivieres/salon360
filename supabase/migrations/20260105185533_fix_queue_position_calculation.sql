/*
  # Fix Queue Position Calculation

  ## Problem
  The get_sorted_technicians_for_store function references q.queue_position, but the
  technician_ready_queue table doesn't have this column. The queue_position needs to
  be calculated using ROW_NUMBER() based on the ready_at timestamp.

  ## Solution
  Add a CTE to calculate queue positions for technicians in the ready state, ordered
  by their ready_at timestamp.

  ## Changes
  - Add queue_with_positions CTE to calculate position using ROW_NUMBER()
  - Join with this CTE instead of directly with technician_ready_queue
  - Maintain proper ordering by ready_at timestamp
*/

-- Drop and recreate with queue position calculation
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
    -- Get all employees who have service assignments
    SELECT DISTINCT es.employee_id
    FROM public.employee_services es
  ),
  queue_with_positions AS (
    -- Calculate queue positions based on ready_at timestamp
    SELECT
      trq.employee_id,
      trq.store_id,
      ROW_NUMBER() OVER (ORDER BY trq.ready_at ASC) as position
    FROM public.technician_ready_queue trq
    WHERE trq.store_id = p_store_id
      AND trq.status = 'ready'
  )
  SELECT
    e.id as employee_id,
    e.display_name,
    e.role,
    CASE
      WHEN ct.employee_id IS NOT NULL THEN 'busy'::text
      WHEN q.employee_id IS NOT NULL THEN 'ready'::text
      ELSE 'unavailable'::text
    END as queue_status,
    q.position::integer as queue_position,
    ct.ticket_id as current_ticket_id,
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
    -- Store filtering using employee_stores junction table
    (
      es_filter.store_id = p_store_id
      OR NOT EXISTS (
        -- If employee has no store assignments, they work at all stores
        SELECT 1 FROM public.employee_stores es_check
        WHERE es_check.employee_id = e.id
      )
    )
    AND (e.status = 'Active' OR e.status = 'active')
  ORDER BY
    CASE
      WHEN ct.employee_id IS NOT NULL THEN 2
      WHEN q.employee_id IS NOT NULL THEN 1
      ELSE 3
    END,
    q.position NULLS LAST,
    e.display_name;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION public.get_sorted_technicians_for_store(uuid, text) IS
'Returns sorted technicians for the queue display. Only includes employees with explicit service assignments in employee_services table. Calculates queue positions based on ready_at timestamp. Uses employee_stores for proper store filtering.';
