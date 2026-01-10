/*
  # Create Missing get_store_timezone Function

  This function was referenced in multiple migrations but never created,
  causing all check-in/check-out operations to fail.

  The stores table does not have a timezone column, so this function
  returns the default EST timezone used throughout the application.

  ## Referenced by:
  - check_in_employee
  - check_out_employee
  - can_checkin_now
  - join_ready_queue_with_checkin
  - technician_queue functions
*/

CREATE OR REPLACE FUNCTION public.get_store_timezone(p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Return default timezone (stores table doesn't have timezone column)
  -- All stores operate in Eastern timezone
  RETURN 'America/New_York';
END;
$$;

COMMENT ON FUNCTION public.get_store_timezone IS
'Returns the timezone for a store. Currently returns America/New_York for all stores. Can be extended in the future to support per-store timezone configuration.';
