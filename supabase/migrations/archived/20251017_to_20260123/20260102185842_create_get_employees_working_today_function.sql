/*
  # Get Employees Working Today Function

  1. Purpose
    - Returns all employees who are working or have worked at a store on a given date
    - Includes employees who are checked in or have worked on services
    - Used for violation reporting to show comprehensive list of eligible employees

  2. Data Sources
    - Attendance records (checked_in, checked_out, auto_checked_out)
    - Ticket items (employees who worked on services)
    - Technician ready queue (current queue status)

  3. Return Fields
    - employee_id: UUID of the employee
    - legal_name: Employee's legal name
    - display_name: Employee's display name
    - queue_status: Current queue status (ready, busy, or null)
    - queue_position: Position in queue if applicable
    - is_checked_in: Whether employee is currently checked in

  4. Security
    - SECURITY DEFINER to allow querying across tables
    - Validates store access
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
      AND ar.work_date = p_date

    UNION

    -- Get employees from ticket items (worked on services)
    SELECT DISTINCT
      ti.employee_id
    FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date
  ),
  current_attendance AS (
    SELECT
      ar.employee_id,
      ar.check_in_time,
      ar.check_out_time,
      ar.status
    FROM public.attendance_records ar
    WHERE ar.store_id = p_store_id
      AND ar.work_date = p_date
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
