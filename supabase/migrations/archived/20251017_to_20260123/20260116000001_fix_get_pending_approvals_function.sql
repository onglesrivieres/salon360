-- Fix get_pending_approvals_for_management function schema qualification
-- The function was recreated without 'public.' prefix in migration 20251219234227
-- This causes "function not found in schema cache" errors

-- Drop both versions (with and without schema prefix) to ensure clean state
DROP FUNCTION IF EXISTS get_pending_approvals_for_management(uuid);
DROP FUNCTION IF EXISTS public.get_pending_approvals_for_management(uuid);

-- Recreate with proper public schema qualification
CREATE FUNCTION public.get_pending_approvals_for_management(
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
  reason text,
  completed_by_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    STRING_AGG(DISTINCT s.name, ', ') as service_name,
    SUM(ti.tip_customer_cash + ti.tip_customer_card) as tip_customer,
    SUM(ti.tip_receptionist) as tip_receptionist,
    st.payment_method,
    COALESCE(st.requires_higher_approval, false) as requires_higher_approval,
    STRING_AGG(DISTINCT emp.display_name, ', ') as technician_names,
    COALESCE(st.approval_reason, 'Requires management review') as reason,
    COALESCE(completed_emp.display_name, 'N/A') as completed_by_name
  FROM public.sale_tickets st
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.employees completed_emp ON st.completed_by = completed_emp.id
  LEFT JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.store_services s ON ti.store_service_id = s.id
  LEFT JOIN public.employees emp ON ti.employee_id = emp.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    -- Include tickets requiring manager approval (conflict of interest OR high tips)
    AND st.approval_required_level = 'manager'
  GROUP BY st.id, e.display_name, completed_emp.display_name
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- Set search_path for security
ALTER FUNCTION public.get_pending_approvals_for_management(p_store_id uuid) SET search_path = '';

-- Add comment
COMMENT ON FUNCTION public.get_pending_approvals_for_management IS 'Returns management-level approval tickets. All tables fully qualified for security.';
