/*
  # Fix Type Casting in get_employees_working_today Function

  1. Problem
    - Function parameter p_date is TEXT type
    - Database columns work_date and ticket_date are DATE type
    - PostgreSQL cannot compare date = text without explicit cast
    - This causes the function to fail with: "operator does not exist: date = text"

  2. Solution
    - Add explicit type casts (::date) at all comparison points
    - Ensures proper type matching for date comparisons

  3. Changes
    - Cast p_date to date type in attendance_records WHERE clause
    - Cast p_date to date type in sale_tickets WHERE clause
    - Cast p_date to date type in current_attendance CTE
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
    e.id AS employee_id,
    e.legal_name,
    e.display_name,
    trq.status AS queue_status,
    trq.queue_position::integer,
    CASE
      WHEN ca.status = 'checked_in' THEN true
      ELSE false
    END AS is_checked_in
  FROM working_employees we
  INNER JOIN public.employees e ON we.employee_id = e.id
  LEFT JOIN (
    SELECT
      employee_id,
      status,
      ROW_NUMBER() OVER (
        ORDER BY ready_at ASC
      ) AS queue_position
    FROM public.technician_ready_queue
    WHERE store_id = p_store_id
      AND status = 'ready'
  ) trq ON e.id = trq.employee_id
  LEFT JOIN current_attendance ca ON e.id = ca.employee_id
  WHERE e.status = 'Active'
  ORDER BY
    CASE WHEN trq.queue_position IS NOT NULL THEN 0 ELSE 1 END,
    trq.queue_position ASC NULLS LAST,
    e.display_name ASC;
END;
$$;
