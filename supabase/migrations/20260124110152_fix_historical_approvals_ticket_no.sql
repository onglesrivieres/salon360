/*
  # Fix Historical Approvals Column Name

  ## Overview
  Fix column reference from ticket_number to ticket_no in historical approval functions.

  ## Changes

  ### Functions
  - `get_historical_approvals_for_manager` - Fixed st.ticket_number → st.ticket_no
  - `get_historical_approvals_for_supervisor` - Fixed st.ticket_number → st.ticket_no

  ## Notes
  - The sale_tickets table uses `ticket_no` (text), not `ticket_number` (integer)
  - Also fixed total_amount reference to use st.total
*/

-- ============================================================================
-- DROP AND RECREATE FUNCTIONS WITH CORRECT COLUMN NAMES
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_historical_approvals_for_manager(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_historical_approvals_for_supervisor(uuid) CASCADE;

-- Recreate get_historical_approvals_for_manager with correct column name
CREATE OR REPLACE FUNCTION public.get_historical_approvals_for_manager(p_store_id uuid)
RETURNS TABLE (
  ticket_id uuid,
  ticket_number text,
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
    st.ticket_no AS ticket_number,
    st.customer_name,
    st.customer_phone,
    st.total AS total_amount,
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
    st.ticket_no,
    st.customer_name,
    st.customer_phone,
    st.total,
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

-- Recreate get_historical_approvals_for_supervisor with correct column name
CREATE OR REPLACE FUNCTION public.get_historical_approvals_for_supervisor(p_store_id uuid)
RETURNS TABLE (
  ticket_id uuid,
  ticket_number text,
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
    st.ticket_no AS ticket_number,
    st.customer_name,
    st.customer_phone,
    st.total AS total_amount,
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
    st.ticket_no,
    st.customer_name,
    st.customer_phone,
    st.total,
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

-- Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';
