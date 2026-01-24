/*
  # Fix Technician Queue Status to Exclude Completed Tickets

  1. Problem
     - Employees checking in and joining queue appear as "busy" instead of "ready"
     - The get_sorted_technicians_for_store function counts tickets as "open" if closed_at IS NULL
     - This incorrectly includes tickets where completed_at IS NOT NULL
     - Completed tickets should not count as "open" even if not yet closed

  2. Solution
     - Update employee_open_tickets CTE to exclude tickets with completed_at IS NOT NULL
     - Only count truly open tickets (not completed AND not closed)
     - This allows employees who check in and join queue to appear as "ready"

  3. Impact
     - Employees will immediately appear as "ready" after check-in and queue join
     - Multi-store employees will show correct status after store selection
     - Completed tickets no longer block technician availability status
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid);

-- Recreate with fixed logic
CREATE OR REPLACE FUNCTION public.get_sorted_technicians_for_store(
  p_store_id uuid
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
AS $$
BEGIN
  RETURN QUERY
  WITH employee_open_tickets AS (
    SELECT
      ti.employee_id,
      COUNT(DISTINCT st.id) as ticket_count,
      MIN(st.opened_at) as oldest_ticket_at,
      SUM(s.duration_min * ti.qty) as total_duration_min
    FROM public.ticket_items ti
    JOIN public.sale_tickets st ON ti.sale_ticket_id = st.id
    JOIN public.services s ON ti.service_id = s.id
    WHERE st.closed_at IS NULL
      AND st.completed_at IS NULL  -- CRITICAL FIX: Exclude completed tickets
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
      AND EXISTS (
        SELECT 1 FROM public.employee_stores es 
        WHERE es.employee_id = e.id 
        AND es.store_id = p_store_id
      )
  )
  SELECT
    e.id as employee_id,
    e.legal_name,
    e.display_name,
    CASE
      WHEN qp.employee_id IS NOT NULL AND qp.status = 'ready' THEN 'ready'  -- PRIORITY FIX: Check queue first
      WHEN eot.ticket_count > 0 THEN 'busy'
      ELSE 'neutral'
    END as queue_status,
    COALESCE(qp.position::integer, 0) as queue_position,
    qp.ready_at,
    qp.current_open_ticket_id,
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
    AND EXISTS (
      SELECT 1 FROM public.employee_stores es 
      WHERE es.employee_id = e.id 
      AND es.store_id = p_store_id
    )
  ORDER BY
    CASE
      WHEN qp.employee_id IS NOT NULL AND qp.status = 'ready' THEN 1  -- PRIORITY FIX: Ready queue members first
      WHEN eot.ticket_count > 0 THEN 3
      ELSE 2
    END,
    qp.ready_at ASC NULLS LAST,
    e.display_name ASC;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.get_sorted_technicians_for_store(p_store_id uuid) SET search_path = '';

-- Add helpful comment
COMMENT ON FUNCTION public.get_sorted_technicians_for_store IS 'Returns sorted technicians for ticket assignment. Prioritizes ready queue members and excludes completed tickets from open count.';
