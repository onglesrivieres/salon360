/*
  # Add Multi-Store Attendance Support

  1. Overview
     - Updates get_store_attendance function to show attendance from ALL stores for multi-store employees
     - Adds store_code to the return type for store identification
     - When viewing attendance for a store, all employees assigned to that store appear
     - For multi-store employees, their attendance from ALL their assigned stores is displayed
     - Maintains all existing filters (date range, employee_id, attendance_display)

  2. Changes
     - Drop existing function and recreate with store_code in return type
     - Join with stores table to fetch store code
     - Update WHERE clause to fetch attendance from all stores for employees assigned to selected store
     - Use employee_stores junction table to identify multi-store employees

  3. Impact
     - Multi-store employees (e.g., Kelsey, Happy, Titan) will appear in all their assigned stores
     - When viewing any store's attendance, their records from ALL stores are visible
     - Store code indicator allows distinguishing which store each attendance record belongs to
     - Total hours calculation automatically sums across all stores

  4. Security
     - Maintains existing employee_id filtering for technicians viewing only their own data
     - All tables fully qualified for security
     - Search path set to empty string
*/

-- ============================================================================
-- DROP AND RECREATE get_store_attendance FUNCTION WITH MULTI-STORE SUPPORT
-- ============================================================================

-- Drop existing function first to allow return type change
DROP FUNCTION IF EXISTS public.get_store_attendance(uuid, date, date, uuid);

-- Create new version with store_code
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
    ar.pay_type,
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
COMMENT ON FUNCTION public.get_store_attendance IS 'Returns attendance records for employees assigned to a store. For multi-store employees, shows attendance from ALL their assigned stores. Includes store_code for identification. All tables fully qualified for security.';
