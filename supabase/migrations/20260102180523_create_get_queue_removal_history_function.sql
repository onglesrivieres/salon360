/*
  # Create Queue Removal History Function
  
  ## Overview
  Creates a function for managers to view queue removal history with filtering options.
  
  ## Function: get_queue_removal_history
  
  ### Parameters:
  - p_store_id (uuid): Filter by store
  - p_start_date (date): Optional start date filter
  - p_end_date (date): Optional end date filter
  
  ### Returns:
  - Table of removal records with employee and remover names
  
  ### Columns Returned:
  - id: Removal record ID
  - employee_id: ID of removed technician
  - employee_name: Name of removed technician
  - employee_code: Code of removed technician
  - removed_by_employee_id: ID of manager who removed them
  - removed_by_name: Name of manager who removed them
  - reason: Reason for removal
  - notes: Additional notes
  - removed_at: Timestamp of removal
  - cooldown_expires_at: When cooldown ends
  - is_active: Whether cooldown is still active
  - minutes_remaining: Minutes left in cooldown (null if expired)
*/

CREATE OR REPLACE FUNCTION public.get_queue_removal_history(
  p_store_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  employee_id uuid,
  employee_name text,
  employee_code text,
  removed_by_employee_id uuid,
  removed_by_name text,
  reason text,
  notes text,
  removed_at timestamptz,
  cooldown_expires_at timestamptz,
  is_active boolean,
  minutes_remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text[];
BEGIN
  -- Get caller's ID and role
  SELECT e.id, e.role INTO v_caller_id, v_caller_role
  FROM public.employees e
  WHERE e.id = auth.uid();
  
  -- Check if caller has permission (Manager, Supervisor, Admin, Owner)
  IF v_caller_id IS NULL OR NOT (v_caller_role && ARRAY['Manager', 'Supervisor', 'Admin', 'Owner']::text[]) THEN
    RAISE EXCEPTION 'You do not have permission to view queue removal history';
  END IF;
  
  -- Check if caller has access to this store
  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_stores
    WHERE employee_id = v_caller_id
      AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'You do not have access to this store';
  END IF;
  
  -- Return removal history with filters
  RETURN QUERY
  SELECT
    qrl.id,
    qrl.employee_id,
    e.name as employee_name,
    e.employee_code,
    qrl.removed_by_employee_id,
    remover.name as removed_by_name,
    qrl.reason,
    qrl.notes,
    qrl.removed_at,
    qrl.cooldown_expires_at,
    (qrl.cooldown_expires_at > now()) as is_active,
    CASE
      WHEN qrl.cooldown_expires_at > now() THEN
        CEIL(EXTRACT(EPOCH FROM (qrl.cooldown_expires_at - now())) / 60)::integer
      ELSE
        NULL
    END as minutes_remaining
  FROM public.queue_removals_log qrl
  JOIN public.employees e ON e.id = qrl.employee_id
  JOIN public.employees remover ON remover.id = qrl.removed_by_employee_id
  WHERE qrl.store_id = p_store_id
    AND (p_start_date IS NULL OR qrl.removed_at::date >= p_start_date)
    AND (p_end_date IS NULL OR qrl.removed_at::date <= p_end_date)
  ORDER BY qrl.removed_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_queue_removal_history IS 'Returns queue removal history for a store with optional date filtering. Accessible to Manager, Supervisor, Admin, and Owner roles.';