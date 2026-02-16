/*
  # Add Historical Approval Functions

  Creates 4 RPC functions to retrieve recently approved/rejected records for
  the Pending Approvals page historical sections:

  1. get_historical_inventory_approvals - Inventory transaction history
  2. get_historical_cash_transaction_approvals - Cash transaction history
  3. get_historical_transaction_change_approvals - Cash transaction change proposal history
  4. get_historical_ticket_reopen_approvals - Ticket reopen request history

  All follow the existing pattern from get_historical_approvals_for_manager:
  SECURITY DEFINER, search_path = public, pg_temp, LIMIT 50, ordered by review timestamp DESC.
*/

-- ============================================================================
-- 1. get_historical_inventory_approvals
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_historical_inventory_approvals(p_store_id uuid)
RETURNS TABLE (
  transaction_id uuid,
  transaction_number text,
  transaction_type text,
  requested_by_name text,
  item_count bigint,
  total_value numeric,
  destination_store_name text,
  source_store_name text,
  status text,
  manager_approved_by_name text,
  manager_approved_at timestamptz,
  rejection_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    it.id AS transaction_id,
    it.transaction_number,
    it.transaction_type,
    COALESCE(requester.display_name, '') AS requested_by_name,
    COUNT(iti.id) AS item_count,
    COALESCE(SUM(iti.total_cost), 0) AS total_value,
    dest_store.name AS destination_store_name,
    src_store.name AS source_store_name,
    it.status,
    COALESCE(approver.display_name, '') AS manager_approved_by_name,
    it.manager_approved_at,
    COALESCE(it.rejection_reason, '') AS rejection_reason
  FROM public.inventory_transactions it
  LEFT JOIN public.employees requester ON requester.id = it.requested_by_id
  LEFT JOIN public.employees approver ON approver.id = it.manager_approved_by_id
  LEFT JOIN public.stores dest_store ON dest_store.id = it.destination_store_id
  LEFT JOIN public.stores src_store ON src_store.id = it.store_id
  LEFT JOIN public.inventory_transaction_items iti ON iti.inventory_transaction_id = it.id
  WHERE
    it.status IN ('approved', 'rejected')
    AND (it.store_id = p_store_id OR it.destination_store_id = p_store_id)
  GROUP BY
    it.id,
    it.transaction_number,
    it.transaction_type,
    requester.display_name,
    dest_store.name,
    src_store.name,
    it.status,
    approver.display_name,
    it.manager_approved_at,
    it.rejection_reason
  ORDER BY it.manager_approved_at DESC NULLS LAST, it.updated_at DESC
  LIMIT 50;
END;
$$;

-- ============================================================================
-- 2. get_historical_cash_transaction_approvals
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_historical_cash_transaction_approvals(p_store_id uuid)
RETURNS TABLE (
  transaction_id uuid,
  transaction_type text,
  amount numeric,
  description text,
  category text,
  date date,
  created_by_name text,
  created_by_id uuid,
  created_by_role text,
  status text,
  manager_approved_by_name text,
  manager_approved_at timestamptz,
  rejection_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ct.id AS transaction_id,
    ct.transaction_type,
    ct.amount,
    ct.description,
    ct.category,
    ct.date,
    COALESCE(creator.display_name, '') AS created_by_name,
    ct.created_by_id,
    CASE
      WHEN 'Admin' = ANY(creator.role) OR 'Manager' = ANY(creator.role) OR 'Owner' = ANY(creator.role) THEN 'Admin'
      WHEN 'Supervisor' = ANY(creator.role) THEN 'Supervisor'
      WHEN 'Receptionist' = ANY(creator.role) THEN 'Receptionist'
      WHEN 'Cashier' = ANY(creator.role) THEN 'Cashier'
      ELSE 'Technician'
    END AS created_by_role,
    ct.status,
    COALESCE(approver.display_name, '') AS manager_approved_by_name,
    ct.manager_approved_at,
    COALESCE(ct.rejection_reason, '') AS rejection_reason
  FROM public.cash_transactions ct
  LEFT JOIN public.employees creator ON creator.id = ct.created_by_id
  LEFT JOIN public.employees approver ON approver.id = ct.manager_approved_by_id
  WHERE
    ct.status IN ('approved', 'rejected')
    AND ct.store_id = p_store_id
  ORDER BY ct.manager_approved_at DESC NULLS LAST, ct.updated_at DESC
  LIMIT 50;
END;
$$;

-- ============================================================================
-- 3. get_historical_transaction_change_approvals
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_historical_transaction_change_approvals(p_store_id uuid)
RETURNS TABLE (
  proposal_id uuid,
  transaction_type text,
  current_amount numeric,
  current_description text,
  is_deletion_request boolean,
  status text,
  created_by_name text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_comment text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS proposal_id,
    ct.transaction_type,
    p.current_amount,
    p.current_description,
    p.is_deletion_request,
    p.status,
    COALESCE(creator.display_name, '') AS created_by_name,
    COALESCE(reviewer.display_name, '') AS reviewed_by_name,
    p.reviewed_at,
    COALESCE(p.review_comment, '') AS review_comment
  FROM public.cash_transaction_change_proposals p
  LEFT JOIN public.cash_transactions ct ON ct.id = p.cash_transaction_id
  LEFT JOIN public.employees creator ON creator.id = p.created_by_employee_id
  LEFT JOIN public.employees reviewer ON reviewer.id = p.reviewed_by_employee_id
  WHERE
    p.status IN ('approved', 'rejected')
    AND p.store_id = p_store_id
  ORDER BY p.reviewed_at DESC NULLS LAST, p.updated_at DESC
  LIMIT 50;
END;
$$;

-- ============================================================================
-- 4. get_historical_ticket_reopen_approvals
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_historical_ticket_reopen_approvals(p_store_id uuid)
RETURNS TABLE (
  request_id uuid,
  ticket_no integer,
  customer_name text,
  total numeric,
  reason_comment text,
  requested_changes_description text,
  status text,
  created_by_name text,
  created_by_id uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_comment text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id AS request_id,
    st.ticket_number AS ticket_no,
    st.customer_name,
    st.total_amount AS total,
    r.reason_comment,
    r.requested_changes_description,
    r.status,
    COALESCE(creator.display_name, '') AS created_by_name,
    r.created_by_employee_id AS created_by_id,
    COALESCE(reviewer.display_name, '') AS reviewed_by_name,
    r.reviewed_at,
    COALESCE(r.review_comment, '') AS review_comment
  FROM public.ticket_reopen_requests r
  LEFT JOIN public.sale_tickets st ON st.id = r.ticket_id
  LEFT JOIN public.employees creator ON creator.id = r.created_by_employee_id
  LEFT JOIN public.employees reviewer ON reviewer.id = r.reviewed_by_employee_id
  WHERE
    r.status IN ('approved', 'rejected')
    AND r.store_id = p_store_id
  ORDER BY r.reviewed_at DESC NULLS LAST, r.updated_at DESC
  LIMIT 50;
END;
$$;

-- ============================================================================
-- FORCE POSTGREST SCHEMA RELOAD
-- ============================================================================

NOTIFY pgrst, 'reload schema';
