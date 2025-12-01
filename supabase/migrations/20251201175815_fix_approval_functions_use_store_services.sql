/*
  # Fix Approval Functions to Use store_services Schema

  1. Overview
     - Updates three approval functions to use new store_services schema
     - Fixes missing service names in approval tickets
     - Changes LEFT JOIN from services to store_services table
     - Uses store_service_id instead of deprecated service_id

  2. Problem
     - Approval functions still reference old global services table
     - ticket_items.service_id is deprecated (nullable, no FK constraint)
     - ticket_items.store_service_id is the new primary reference
     - Service names showing as NULL/empty in approval UI

  3. Functions Fixed
     - get_pending_approvals_for_technician() - Line 181 changed
     - get_pending_approvals_for_supervisor() - Line 250 changed
     - get_pending_approvals_for_management() - Line 325 changed

  4. Changes Made
     - Replace: LEFT JOIN public.services s ON ti.service_id = s.id
     - With: LEFT JOIN public.store_services ss ON ti.store_service_id = ss.id
     - Update STRING_AGG to use ss.name instead of s.name

  5. Impact
     - Service names will now display correctly in approval screens
     - No breaking changes to function signatures or return types
     - Backward compatible with existing frontend code

  6. Security
     - Maintains existing RLS policies
     - Preserves search_path security settings
*/

-- ============================================================================
-- FIX TECHNICIAN APPROVAL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_approvals_for_technician(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_no text,
  ticket_date date,
  closed_at timestamptz,
  approval_deadline timestamptz,
  customer_name text,
  customer_phone text,
  total numeric,
  closed_by_name text,
  hours_remaining numeric,
  service_name text,
  tip_customer numeric,
  tip_receptionist numeric,
  payment_method text,
  requires_higher_approval boolean,
  approval_reason text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id as ticket_id,
    st.ticket_no,
    st.ticket_date,
    st.closed_at,
    st.approval_deadline,
    st.customer_name,
    st.customer_phone,
    st.total,
    COALESCE(e.display_name, 'Unknown') as closed_by_name,
    EXTRACT(EPOCH FROM (st.approval_deadline - NOW())) / 3600 as hours_remaining,
    STRING_AGG(DISTINCT COALESCE(ss.name, ti.custom_service_name), ', ') as service_name,
    COALESCE(SUM(ti.tip_customer_cash + ti.tip_customer_card), 0) as tip_customer,
    COALESCE(SUM(ti.tip_receptionist), 0) as tip_receptionist,
    st.payment_method,
    COALESCE(st.requires_higher_approval, false) as requires_higher_approval,
    st.approval_reason
  FROM public.sale_tickets st
  INNER JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.store_services ss ON ti.store_service_id = ss.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    AND st.approval_required_level = 'technician'
    AND ti.employee_id = p_employee_id
    AND st.closed_by != p_employee_id
  GROUP BY st.id, e.display_name, st.ticket_no, st.ticket_date, st.closed_at,
           st.approval_deadline, st.customer_name, st.customer_phone, st.total,
           st.payment_method, st.requires_higher_approval, st.approval_reason
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.get_pending_approvals_for_technician(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- ============================================================================
-- FIX SUPERVISOR APPROVAL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_approvals_for_supervisor(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_no text,
  ticket_date date,
  closed_at timestamptz,
  approval_deadline timestamptz,
  customer_name text,
  customer_phone text,
  total numeric,
  closed_by_name text,
  hours_remaining numeric,
  service_name text,
  tip_customer numeric,
  tip_receptionist numeric,
  payment_method text,
  requires_higher_approval boolean,
  approval_reason text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id as ticket_id,
    st.ticket_no,
    st.ticket_date,
    st.closed_at,
    st.approval_deadline,
    st.customer_name,
    st.customer_phone,
    st.total,
    COALESCE(e.display_name, 'Unknown') as closed_by_name,
    EXTRACT(EPOCH FROM (st.approval_deadline - NOW())) / 3600 as hours_remaining,
    STRING_AGG(DISTINCT COALESCE(ss.name, ti.custom_service_name), ', ') as service_name,
    COALESCE(SUM(ti.tip_customer_cash + ti.tip_customer_card), 0) as tip_customer,
    COALESCE(SUM(ti.tip_receptionist), 0) as tip_receptionist,
    st.payment_method,
    COALESCE(st.requires_higher_approval, false) as requires_higher_approval,
    st.approval_reason
  FROM public.sale_tickets st
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.store_services ss ON ti.store_service_id = ss.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    AND st.approval_required_level = 'supervisor'
    AND st.closed_by != p_employee_id
    AND (
      st.approval_performer_id IS NULL
      OR st.approval_performer_id = p_employee_id
    )
  GROUP BY st.id, e.display_name, st.ticket_no, st.ticket_date, st.closed_at,
           st.approval_deadline, st.customer_name, st.customer_phone, st.total,
           st.payment_method, st.requires_higher_approval, st.approval_reason
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.get_pending_approvals_for_supervisor(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- ============================================================================
-- FIX MANAGEMENT APPROVAL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_approvals_for_management(
  p_store_id uuid
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_no text,
  ticket_date date,
  closed_at timestamptz,
  approval_deadline timestamptz,
  customer_name text,
  customer_phone text,
  total numeric,
  closed_by_name text,
  closed_by_roles jsonb,
  hours_remaining numeric,
  service_name text,
  tip_customer numeric,
  tip_receptionist numeric,
  payment_method text,
  requires_higher_approval boolean,
  technician_names text,
  reason text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id as ticket_id,
    st.ticket_no,
    st.ticket_date,
    st.closed_at,
    st.approval_deadline,
    st.customer_name,
    st.customer_phone,
    st.total,
    COALESCE(e.display_name, 'Unknown') as closed_by_name,
    st.closed_by_roles,
    EXTRACT(EPOCH FROM (st.approval_deadline - NOW())) / 3600 as hours_remaining,
    STRING_AGG(DISTINCT COALESCE(ss.name, ti.custom_service_name), ', ') as service_name,
    COALESCE(SUM(ti.tip_customer_cash + ti.tip_customer_card), 0) as tip_customer,
    COALESCE(SUM(ti.tip_receptionist), 0) as tip_receptionist,
    st.payment_method,
    COALESCE(st.requires_higher_approval, false) as requires_higher_approval,
    STRING_AGG(DISTINCT emp.display_name, ', ') as technician_names,
    COALESCE(st.approval_reason, 'Requires management review') as reason
  FROM public.sale_tickets st
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.store_services ss ON ti.store_service_id = ss.id
  LEFT JOIN public.employees emp ON ti.employee_id = emp.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    AND st.approval_required_level = 'manager'
  GROUP BY st.id, e.display_name, st.ticket_no, st.ticket_date, st.closed_at,
           st.approval_deadline, st.customer_name, st.customer_phone, st.total,
           st.closed_by_roles, st.payment_method, st.requires_higher_approval, st.approval_reason
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.get_pending_approvals_for_management(p_store_id uuid) SET search_path = '';