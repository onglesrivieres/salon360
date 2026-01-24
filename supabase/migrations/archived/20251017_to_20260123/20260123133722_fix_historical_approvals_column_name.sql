/*
  # Fix Historical Approvals Column Name

  ## Problem
  The historical approval functions reference `st.completed_by_id` but the actual
  column in sale_tickets is `completed_by` (without the `_id` suffix).

  ## Fix
  Update both functions to use the correct column name `completed_by`.
*/

-- Fix get_historical_approvals_for_manager function
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
    completed_by.name AS completed_by_name,
    st.approval_status,
    st.approved_at,
    st.approved_by_id,
    approved_by.name AS approved_by_name,
    st.requires_supervisor_approval,
    string_agg(DISTINCT COALESCE(ss.name, sti.custom_service_name), ', ') AS service_names
  FROM public.sale_tickets st
  LEFT JOIN public.employees completed_by ON completed_by.id = st.completed_by
  LEFT JOIN public.employees approved_by ON approved_by.id = st.approved_by_id
  LEFT JOIN public.ticket_items sti ON sti.ticket_id = st.id
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
    completed_by.name,
    st.approval_status,
    st.approved_at,
    st.approved_by_id,
    approved_by.name,
    st.requires_supervisor_approval
  ORDER BY st.approved_at DESC NULLS LAST, st.completed_at DESC;
END;
$$;

-- Fix get_historical_approvals_for_supervisor function
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
    completed_by.name AS completed_by_name,
    st.approval_status,
    st.approved_at,
    st.approved_by_id,
    approved_by.name AS approved_by_name,
    st.requires_supervisor_approval,
    string_agg(DISTINCT COALESCE(ss.name, sti.custom_service_name), ', ') AS service_names
  FROM public.sale_tickets st
  LEFT JOIN public.employees completed_by ON completed_by.id = st.completed_by
  LEFT JOIN public.employees approved_by ON approved_by.id = st.approved_by_id
  LEFT JOIN public.ticket_items sti ON sti.ticket_id = st.id
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
    completed_by.name,
    st.approval_status,
    st.approved_at,
    st.approved_by_id,
    approved_by.name,
    st.requires_supervisor_approval
  ORDER BY st.approved_at DESC NULLS LAST, st.completed_at DESC;
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
