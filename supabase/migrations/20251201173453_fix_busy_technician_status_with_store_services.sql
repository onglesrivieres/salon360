/*
  # Fix BUSY Technician Status to Use store_services Schema

  1. Overview
     - Updates get_sorted_technicians_for_store function to use new store_services schema
     - Fixes BUSY employee behavior including countdown timers and ticket counts
     - Changes JOIN from deprecated services table to store_services table
     - Handles both regular store services and custom ad-hoc services

  2. Problem
     - Function was using old schema: JOIN services s ON ti.service_id = s.id
     - Schema migrated to: store_services with store_service_id
     - This caused BUSY technicians to not appear correctly
     - Countdown timers, open ticket counts, and duration calculations all failed

  3. Solution
     - Change JOIN to LEFT JOIN store_services on ti.store_service_id
     - Use LEFT JOIN to handle custom services (where store_service_id is NULL)
     - Update duration calculation to use ss.duration_min from store_services
     - Maintain COALESCE for NULL durations on custom services

  4. Impact
     - BUSY technicians will show correctly with red background and lock icon
     - Countdown timers will display estimated time remaining
     - Open ticket counts will be accurate
     - Busy technicians can still be assigned additional tickets
     - Automatic status change when ticket items are created works properly
*/

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid, DATE);

-- Recreate with updated store_services schema
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
      -- Use LEFT JOIN to handle both regular services and custom services
      -- For custom services, duration_min will be NULL and default to 0
      SUM(COALESCE(ss.duration_min, 0) * ti.qty) as total_duration_min
    FROM public.ticket_items ti
    JOIN public.sale_tickets st ON ti.sale_ticket_id = st.id
    -- LEFT JOIN because custom services don't have store_service_id
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
      WHEN eot.oldest_ticket_at IS NOT NULL AND eot.total_duration_min IS NOT NULL AND eot.total_duration_min > 0
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
