-- Add closed_by UUID to approval RPC return types
-- This allows Receptionist role to filter tickets to only those they closed

-- ============================================================================
-- FUNCTION: get_pending_approvals_for_management (updated)
-- Added: closed_by uuid column
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_approvals_for_management(p_store_id uuid)
RETURNS TABLE (
  ticket_id uuid, ticket_no text, ticket_date date, closed_at timestamptz, approval_deadline timestamptz,
  customer_name text, customer_phone text, total numeric, closed_by_name text, closed_by_roles jsonb,
  hours_remaining numeric, service_name text, tip_customer numeric, tip_receptionist numeric,
  payment_method text, requires_higher_approval boolean, technician_names text, reason text, completed_by_name text,
  closed_by uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT st.id, st.ticket_no, st.ticket_date, st.closed_at, st.approval_deadline, st.customer_name, st.customer_phone, st.total,
         COALESCE(e.display_name, 'Unknown'), st.closed_by_roles, EXTRACT(EPOCH FROM (st.approval_deadline - NOW())) / 3600,
         STRING_AGG(DISTINCT s.name, ', '), SUM(ti.tip_customer_cash + ti.tip_customer_card), SUM(ti.tip_receptionist),
         st.payment_method, COALESCE(st.requires_higher_approval, false), STRING_AGG(DISTINCT emp.display_name, ', '),
         COALESCE(st.approval_reason, 'Requires management review'), COALESCE(completed_emp.display_name, 'N/A'),
         st.closed_by
  FROM public.sale_tickets st
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.employees completed_emp ON st.completed_by = completed_emp.id
  LEFT JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.store_services s ON ti.store_service_id = s.id
  LEFT JOIN public.employees emp ON ti.employee_id = emp.id
  WHERE st.store_id = p_store_id AND st.approval_status = 'pending_approval' AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW() AND st.approval_required_level IN ('manager', 'owner')
  GROUP BY st.id, e.display_name, completed_emp.display_name ORDER BY st.approval_deadline ASC;
END;
$$;

-- ============================================================================
-- FUNCTION: get_rejected_tickets_for_admin (updated)
-- Added: closed_by uuid column
-- ============================================================================
CREATE OR REPLACE FUNCTION get_rejected_tickets_for_admin(
  p_store_id uuid
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_no text,
  ticket_date date,
  closed_at timestamptz,
  customer_type text,
  total numeric,
  rejection_reason text,
  rejected_by_id uuid,
  rejected_by_name text,
  rejected_at timestamptz,
  technician_name text,
  service_name text,
  closed_by uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (st.id)
    st.id as ticket_id,
    st.ticket_no,
    st.ticket_date,
    st.closed_at,
    st.customer_type,
    st.total,
    st.rejection_reason,
    st.approved_by as rejected_by_id,
    e.display_name as rejected_by_name,
    st.approved_at as rejected_at,
    te.display_name as technician_name,
    COALESCE(s.name, ti.custom_service_name, 'Service') as service_name,
    st.closed_by
  FROM public.sale_tickets st
  LEFT JOIN public.employees e ON e.id = st.approved_by
  LEFT JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.employees te ON te.id = ti.employee_id
  LEFT JOIN public.services s ON s.id = ti.service_id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'rejected'
    AND st.requires_admin_review = true
  ORDER BY st.id, st.closed_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
