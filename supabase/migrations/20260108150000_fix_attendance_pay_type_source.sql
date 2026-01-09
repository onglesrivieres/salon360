/*
  # Fix Attendance Pay Type Source

  ## Problem
  The get_store_attendance function returns ar.pay_type (pay type at check-in time)
  instead of e.pay_type (current employee pay type). This causes employees to appear
  in the wrong category if their pay type was changed after creating attendance records.

  ## Solution
  Update get_store_attendance to return e.pay_type from the employees table instead
  of ar.pay_type from attendance_records.

  ## Impact
  - Employees will be categorized by their current pay type setting
  - Fixes issue where Mimi (and similar employees) appear in wrong category
  - No data migration needed - only the query is updated
*/

-- Drop and recreate the function with corrected pay_type source
DROP FUNCTION IF EXISTS public.get_store_attendance(uuid, date, date, uuid);

CREATE OR REPLACE FUNCTION public.get_store_attendance(
  p_store_id uuid,
  p_start_date date,
  p_end_date date,
  p_employee_id uuid DEFAULT NULL
)
RETURNS TABLE (
  attendance_record_id uuid,
  employee_id uuid,
  employee_name text,
  work_date date,
  check_in_time timestamptz,
  check_out_time timestamptz,
  total_hours numeric,
  status text,
  pay_type text,
  store_code text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id as attendance_record_id,
    ar.employee_id,
    e.display_name as employee_name,
    ar.work_date,
    ar.check_in_time,
    ar.check_out_time,
    ar.total_hours,
    ar.status,
    e.pay_type,  -- Use current pay_type from employees table, not historical from attendance_records
    s.code as store_code
  FROM public.attendance_records ar
  JOIN public.employees e ON ar.employee_id = e.id
  JOIN public.stores s ON ar.store_id = s.id
  WHERE
    -- Show attendance from ALL stores for employees assigned to the selected store
    ar.employee_id IN (
      SELECT es.employee_id
      FROM public.employee_stores es
      WHERE es.store_id = p_store_id
    )
    AND ar.work_date BETWEEN p_start_date AND p_end_date
    AND (p_employee_id IS NULL OR ar.employee_id = p_employee_id)
    AND (e.attendance_display IS NULL OR e.attendance_display = true)
  ORDER BY ar.work_date DESC, ar.check_in_time ASC;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.get_store_attendance(p_store_id uuid, p_start_date date, p_end_date date, p_employee_id uuid) SET search_path = '';

-- Add comment
COMMENT ON FUNCTION public.get_store_attendance IS 'Returns attendance records for employees assigned to a store. Uses current pay_type from employees table (not historical from attendance_records). For multi-store employees, shows attendance from ALL their assigned stores. Includes store_code for identification. All tables fully qualified for security.';
