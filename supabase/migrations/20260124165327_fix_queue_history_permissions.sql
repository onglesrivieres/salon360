/*
  # Fix Queue History Permissions

  ## Overview
  Fixes the "You do not have permission to view queue removal history" error
  by changing the function to accept employee_id as a parameter instead of
  using auth.uid() (which returns NULL since Salon360 uses PIN-based auth).

  ## Changes

  ### Functions
  - `get_queue_removal_history` - Accept p_employee_id parameter for permission checks

  ## Notes
  - Salon360 uses PIN-based authentication, not Supabase's built-in auth
  - auth.uid() returns NULL, causing all permission checks to fail
  - The fix passes employee_id from the frontend session
*/

-- ============================================================================
-- FIX get_queue_removal_history FUNCTION
-- ============================================================================

-- Must drop first because we're changing the function signature
DROP FUNCTION IF EXISTS public.get_queue_removal_history(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_queue_removal_history(uuid, uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_queue_removal_history(
  p_employee_id uuid,
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
  minutes_remaining integer,
  has_cooldown boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_caller_role text[];
BEGIN
  -- Get caller's ID and role using the passed employee_id (not auth.uid())
  SELECT e.id, e.role INTO v_caller_id, v_caller_role
  FROM public.employees e
  WHERE e.id = p_employee_id;

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
    END as minutes_remaining,
    (qrl.reason != 'Queue adjustment') as has_cooldown
  FROM public.queue_removals_log qrl
  JOIN public.employees e ON e.id = qrl.employee_id
  JOIN public.employees remover ON remover.id = qrl.removed_by_employee_id
  WHERE qrl.store_id = p_store_id
    AND (p_start_date IS NULL OR qrl.removed_at::date >= p_start_date)
    AND (p_end_date IS NULL OR qrl.removed_at::date <= p_end_date)
  ORDER BY qrl.removed_at DESC;
END;
$$;

COMMENT ON FUNCTION public.get_queue_removal_history IS 'Returns queue removal history for a store with optional date filtering. Requires p_employee_id for permission validation. Accessible to Manager, Supervisor, Admin, and Owner roles.';
