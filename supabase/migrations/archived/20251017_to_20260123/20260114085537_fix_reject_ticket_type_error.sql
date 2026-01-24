-- Fix reject_ticket function to use explicit schema-qualified type
-- This fixes the "type 'sale_tickets' does not exist" error caused by empty search_path

CREATE OR REPLACE FUNCTION reject_ticket(
  p_ticket_id uuid,
  p_employee_id uuid,
  p_rejection_reason text
)
RETURNS json AS $$
DECLARE
  v_ticket public.sale_tickets%ROWTYPE;
BEGIN
  -- Get the ticket
  SELECT * INTO v_ticket FROM public.sale_tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Ticket not found');
  END IF;

  -- Check if ticket is in pending_approval status
  IF v_ticket.approval_status != 'pending_approval' THEN
    RETURN json_build_object('success', false, 'message', 'Ticket is not pending approval');
  END IF;

  -- Check if employee is assigned to this ticket
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_items WHERE sale_ticket_id = p_ticket_id AND employee_id = p_employee_id
  ) THEN
    RETURN json_build_object('success', false, 'message', 'You are not assigned to this ticket');
  END IF;

  -- Reject the ticket
  UPDATE public.sale_tickets
  SET
    approval_status = 'rejected',
    rejection_reason = p_rejection_reason,
    requires_admin_review = true,
    updated_at = now()
  WHERE id = p_ticket_id;

  RETURN json_build_object('success', true, 'message', 'Ticket rejected and sent for admin review');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
