-- Remove customer_type column from sale_tickets
-- This field (Appointment/Assigned/Requested) is no longer used in the application.

-- Drop the column
ALTER TABLE public.sale_tickets DROP COLUMN IF EXISTS customer_type;

-- Drop and recreate get_rejected_tickets_for_admin without customer_type
-- (DROP required because return type changed — removed customer_type column)
DROP FUNCTION IF EXISTS get_rejected_tickets_for_admin(uuid);
CREATE OR REPLACE FUNCTION get_rejected_tickets_for_admin(
  p_store_id uuid
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_no text,
  ticket_date date,
  closed_at timestamptz,
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

NOTIFY pgrst, 'reload schema';
