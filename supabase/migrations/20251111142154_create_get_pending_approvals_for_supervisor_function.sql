/*
  # Create get_pending_approvals_for_supervisor Function
  
  ## Overview
  Creates the missing function for supervisors to view and approve tickets
  that require supervisor-level approval.
  
  ## Function Details
  - `get_pending_approvals_for_supervisor(p_employee_id, p_store_id)`
    - Returns pending tickets requiring supervisor approval
    - Excludes tickets the supervisor closed themselves
    - Shows tickets with approval_required_level = 'supervisor'
    
  ## Returns
  - ticket_id: UUID of the ticket
  - ticket_no: Ticket number
  - ticket_date: Date of the ticket
  - closed_at: When ticket was closed
  - approval_deadline: Deadline for approval
  - customer_name: Customer name
  - customer_phone: Customer phone
  - total: Ticket total amount
  - closed_by_name: Name of person who closed ticket
  - hours_remaining: Hours until auto-approval
  - service_name: Service(s) performed
  - tip_customer: Customer tips
  - tip_receptionist: Receptionist tips
  - payment_method: Payment method used
  - requires_higher_approval: Flag for higher approval needed
  - approval_reason: Reason for approval requirement
  
  ## Security
  - Function uses existing RLS policies
  - Supervisors can only see tickets in their assigned stores
  - Cannot approve tickets they closed themselves
*/

-- Create function for supervisor-level approvals
CREATE OR REPLACE FUNCTION get_pending_approvals_for_supervisor(
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
SET search_path = public, pg_temp
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
    STRING_AGG(DISTINCT s.name, ', ') as service_name,
    COALESCE(SUM(ti.tip_customer_cash + ti.tip_customer_card), 0) as tip_customer,
    COALESCE(SUM(ti.tip_receptionist), 0) as tip_receptionist,
    st.payment_method,
    COALESCE(st.requires_higher_approval, false) as requires_higher_approval,
    st.approval_reason
  FROM sale_tickets st
  LEFT JOIN employees e ON st.closed_by = e.id
  LEFT JOIN ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN services s ON ti.service_id = s.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    -- Only show tickets requiring supervisor-level approval
    AND st.approval_required_level = 'supervisor'
    -- Supervisor cannot approve tickets they closed
    AND st.closed_by != p_employee_id
  GROUP BY st.id, e.display_name, st.ticket_no, st.ticket_date, st.closed_at, 
           st.approval_deadline, st.customer_name, st.customer_phone, st.total,
           st.payment_method, st.requires_higher_approval, st.approval_reason
  ORDER BY st.approval_deadline ASC;
END;
$$;
