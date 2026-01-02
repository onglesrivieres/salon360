/*
  # Fix Column Ambiguity in get_employees_working_today Function

  1. Problem
    - Return column named "employee_id" conflicts with table columns
    - PostgreSQL cannot determine which "employee_id" is being referenced
    - Error: "column reference 'employee_id' is ambiguous"

  2. Solution
    - Fully qualify all column references with table aliases
    - Use explicit aliases in subqueries to avoid confusion

  3. Changes
    - Qualify employee_id references in technician_ready_queue subquery
    - Ensure all column references are unambiguous
*/

CREATE OR REPLACE FUNCTION public.get_employees_working_today(
  p_store_id uuid,
  p_date text
)
RETURNS TABLE (
  employee_id uuid,
  legal_name text,
  display_name text,
  queue_status text,
  queue_position integer,
  is_checked_in boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH working_employees AS (
    -- Get employees from attendance records
    SELECT DISTINCT
      ar.employee_id
    FROM public.attendance_records ar
    WHERE ar.store_id = p_store_id
      AND ar.work_date = p_date::date

    UNION

    -- Get employees from ticket items (worked on services)
    SELECT DISTINCT
      ti.employee_id
    FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
  ),
  current_attendance AS (
    SELECT
      ar.employee_id,
      ar.check_in_time,
      ar.check_out_time,
      ar.status
    FROM public.attendance_records ar
    WHERE ar.store_id = p_store_id
      AND ar.work_date = p_date::date
  )
  SELECT
    e.id,
    e.legal_name,
    e.display_name,
    trq.status,
    trq.queue_position::integer,
    CASE
      WHEN ca.status = 'checked_in' THEN true
      ELSE false
    END
  FROM working_employees we
  INNER JOIN public.employees e ON we.employee_id = e.id
  LEFT JOIN (
    SELECT
      trq_inner.employee_id,
      trq_inner.status,
      ROW_NUMBER() OVER (
        ORDER BY trq_inner.ready_at ASC
      ) AS queue_position
    FROM public.technician_ready_queue trq_inner
    WHERE trq_inner.store_id = p_store_id
      AND trq_inner.status = 'ready'
  ) trq ON e.id = trq.employee_id
  LEFT JOIN current_attendance ca ON e.id = ca.employee_id
  WHERE e.status = 'Active'
  ORDER BY
    CASE WHEN trq.queue_position IS NOT NULL THEN 0 ELSE 1 END,
    trq.queue_position ASC NULLS LAST,
    e.display_name ASC;
END;
$$;
