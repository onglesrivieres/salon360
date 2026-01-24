/*
  # Exclude Cashiers from Technician Functions

  1. Changes
    - Update get_sorted_technicians_for_store to explicitly exclude Cashier role
    - Cashiers are administrative staff and should not appear in technician queues
    - Cashiers should not be assignable to service tickets

  2. Security
    - No RLS policy changes
    - Function continues to use SECURITY DEFINER
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS get_sorted_technicians_for_store(uuid, DATE);

-- Recreate with Cashier exclusion
CREATE FUNCTION get_sorted_technicians_for_store(
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
SECURITY DEFINER
AS $$
DECLARE
  v_day_name text;
BEGIN
  -- Calculate day of week from provided date
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
    FROM ticket_items ti
    JOIN sale_tickets st ON ti.sale_ticket_id = st.id
    JOIN services s ON ti.service_id = s.id
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
    FROM technician_ready_queue trq
    JOIN employees e ON trq.employee_id = e.id
    WHERE trq.store_id = p_store_id
      AND trq.status = 'ready'
      AND LOWER(e.status) = 'active'
      AND (e.role @> ARRAY['Technician']::text[] OR e.role @> ARRAY['Supervisor']::text[] OR e.role @> ARRAY['Spa Expert']::text[])
      AND NOT e.role @> ARRAY['Cashier']::text[]
      AND EXISTS (
        SELECT 1 FROM employee_stores es
        WHERE es.employee_id = e.id
        AND es.store_id = p_store_id
      )
      AND (
        e.weekly_schedule IS NULL 
        OR COALESCE((e.weekly_schedule->v_day_name)::boolean, true) = true
        OR EXISTS (
          SELECT 1 FROM attendance_records ar 
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
  FROM employees e
  LEFT JOIN queue_positions qp ON e.id = qp.employee_id
  LEFT JOIN employee_open_tickets eot ON e.id = eot.employee_id
  WHERE LOWER(e.status) = 'active'
    AND (e.role @> ARRAY['Technician']::text[] OR e.role @> ARRAY['Supervisor']::text[] OR e.role @> ARRAY['Spa Expert']::text[])
    AND NOT e.role @> ARRAY['Cashier']::text[]
    AND EXISTS (
      SELECT 1 FROM employee_stores es
      WHERE es.employee_id = e.id
      AND es.store_id = p_store_id
    )
    AND (
      e.weekly_schedule IS NULL 
      OR COALESCE((e.weekly_schedule->v_day_name)::boolean, true) = true
      OR EXISTS (
        SELECT 1 FROM attendance_records ar 
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
