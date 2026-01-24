/*
  # Force Recreate Approval Functions

  ## Problem
  Despite migrations being marked as applied, errors persist:
  - "column reference 'employee_id' is ambiguous"
  - "column sti.ticket_id does not exist"

  This suggests PostgREST is caching stale function definitions.

  ## Solution
  Drop ALL overloads of these functions and recreate them fresh.
*/

-- ============================================================================
-- DROP ALL FUNCTION OVERLOADS
-- ============================================================================

-- Drop all possible signatures of get_queue_removal_history
DROP FUNCTION IF EXISTS public.get_queue_removal_history(uuid, date, date) CASCADE;
DROP FUNCTION IF EXISTS public.get_queue_removal_history(uuid, uuid, date, date) CASCADE;
DROP FUNCTION IF EXISTS public.get_queue_removal_history() CASCADE;

-- Drop historical approval functions
DROP FUNCTION IF EXISTS public.get_historical_approvals_for_manager(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_historical_approvals_for_supervisor(uuid) CASCADE;

-- Force PostgREST to notice the drops
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- RECREATE get_queue_removal_history
-- ============================================================================

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
#variable_conflict use_column
DECLARE
  v_caller_id uuid;
  v_caller_role text[];
BEGIN
  -- Get caller's ID and role using the passed employee_id
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
    FROM public.employee_stores es
    WHERE es.employee_id = v_caller_id
      AND es.store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'You do not have access to this store';
  END IF;

  -- Return removal history with filters
  RETURN QUERY
  SELECT
    qrl.id,
    qrl.employee_id,
    e.display_name as employee_name,
    qrl.removed_by_employee_id,
    remover.display_name as removed_by_name,
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

COMMENT ON FUNCTION public.get_queue_removal_history IS 'Returns queue removal history for a store with optional date filtering.';

-- ============================================================================
-- RECREATE get_historical_approvals_for_manager
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_historical_approvals_for_manager(p_store_id uuid)
RETURNS TABLE (
  ticket_id uuid,
  ticket_number integer,
  customer_name text,
  customer_phone text,
  total_amount numeric,
  created_at timestamptz,
  completed_at timestamptz,
  completed_by_id uuid,
  completed_by_name text,
  approval_status text,
  approved_at timestamptz,
  approved_by_id uuid,
  approved_by_name text,
  requires_supervisor_approval boolean,
  service_names text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id AS ticket_id,
    st.ticket_number,
    st.customer_name,
    st.customer_phone,
    st.total_amount,
    st.created_at,
    st.completed_at,
    st.completed_by AS completed_by_id,
    completed_emp.display_name AS completed_by_name,
    st.approval_status,
    st.approved_at,
    st.approved_by AS approved_by_id,
    approved_emp.display_name AS approved_by_name,
    st.requires_supervisor_approval,
    string_agg(DISTINCT COALESCE(ss.name, sti.custom_service_name), ', ') AS service_names
  FROM public.sale_tickets st
  LEFT JOIN public.employees completed_emp ON completed_emp.id = st.completed_by
  LEFT JOIN public.employees approved_emp ON approved_emp.id = st.approved_by
  LEFT JOIN public.ticket_items sti ON sti.sale_ticket_id = st.id
  LEFT JOIN public.store_services ss ON ss.id = sti.store_service_id
  WHERE
    st.store_id = p_store_id
    AND st.completed_at IS NOT NULL
    AND st.approval_status IN ('approved', 'rejected')
    AND (
      st.requires_supervisor_approval = false
      OR st.requires_supervisor_approval IS NULL
    )
  GROUP BY
    st.id,
    st.ticket_number,
    st.customer_name,
    st.customer_phone,
    st.total_amount,
    st.created_at,
    st.completed_at,
    st.completed_by,
    completed_emp.display_name,
    st.approval_status,
    st.approved_at,
    st.approved_by,
    approved_emp.display_name,
    st.requires_supervisor_approval
  ORDER BY st.approved_at DESC NULLS LAST, st.completed_at DESC;
END;
$$;

-- ============================================================================
-- RECREATE get_historical_approvals_for_supervisor
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_historical_approvals_for_supervisor(p_store_id uuid)
RETURNS TABLE (
  ticket_id uuid,
  ticket_number integer,
  customer_name text,
  customer_phone text,
  total_amount numeric,
  created_at timestamptz,
  completed_at timestamptz,
  completed_by_id uuid,
  completed_by_name text,
  approval_status text,
  approved_at timestamptz,
  approved_by_id uuid,
  approved_by_name text,
  requires_supervisor_approval boolean,
  service_names text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id AS ticket_id,
    st.ticket_number,
    st.customer_name,
    st.customer_phone,
    st.total_amount,
    st.created_at,
    st.completed_at,
    st.completed_by AS completed_by_id,
    completed_emp.display_name AS completed_by_name,
    st.approval_status,
    st.approved_at,
    st.approved_by AS approved_by_id,
    approved_emp.display_name AS approved_by_name,
    st.requires_supervisor_approval,
    string_agg(DISTINCT COALESCE(ss.name, sti.custom_service_name), ', ') AS service_names
  FROM public.sale_tickets st
  LEFT JOIN public.employees completed_emp ON completed_emp.id = st.completed_by
  LEFT JOIN public.employees approved_emp ON approved_emp.id = st.approved_by
  LEFT JOIN public.ticket_items sti ON sti.sale_ticket_id = st.id
  LEFT JOIN public.store_services ss ON ss.id = sti.store_service_id
  WHERE
    st.store_id = p_store_id
    AND st.completed_at IS NOT NULL
    AND st.approval_status IN ('approved', 'rejected')
    AND st.requires_supervisor_approval = true
  GROUP BY
    st.id,
    st.ticket_number,
    st.customer_name,
    st.customer_phone,
    st.total_amount,
    st.created_at,
    st.completed_at,
    st.completed_by,
    completed_emp.display_name,
    st.approval_status,
    st.approved_at,
    st.approved_by,
    approved_emp.display_name,
    st.requires_supervisor_approval
  ORDER BY st.approved_at DESC NULLS LAST, st.completed_at DESC;
END;
$$;

-- ============================================================================
-- FORCE POSTGREST SCHEMA RELOAD
-- ============================================================================

-- Send multiple reload notifications to ensure cache is cleared
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
