/*
  # Filter Attendance by attendance_display

  1. Overview
     - Updates get_store_attendance function to exclude employees with attendance_display = false
     - Maintains backward compatibility (NULL treated as true)
     - Affects both current and historical attendance data visibility

  2. Changes
     - Add filter condition: AND (e.attendance_display IS NULL OR e.attendance_display = true)
     - Only show employees who are allowed to use attendance system
     - Maintains all other existing functionality

  3. Impact
     - Employees with attendance_display = false will not appear on Attendance page
     - Historical attendance data for these employees will also be hidden
     - Existing employees with NULL will continue to be visible (backward compatible)
*/

-- ============================================================================
-- UPDATE get_store_attendance FUNCTION WITH attendance_display FILTER
-- ============================================================================

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
  pay_type text
)
LANGUAGE plpgsql
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
    ar.pay_type
  FROM public.attendance_records ar
  JOIN public.employees e ON ar.employee_id = e.id
  WHERE ar.store_id = p_store_id
    AND ar.work_date BETWEEN p_start_date AND p_end_date
    AND (p_employee_id IS NULL OR ar.employee_id = p_employee_id)
    AND (e.attendance_display IS NULL OR e.attendance_display = true)
  ORDER BY ar.work_date DESC, ar.check_in_time ASC;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.get_store_attendance(p_store_id uuid, p_start_date date, p_end_date date, p_employee_id uuid) SET search_path = '';

-- Add comment
COMMENT ON FUNCTION public.get_store_attendance IS 'Returns attendance records for store and date range. Filters out employees with attendance_display = false. All tables fully qualified for security.';
