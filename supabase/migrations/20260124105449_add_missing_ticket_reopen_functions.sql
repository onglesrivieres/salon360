-- Migration: Add missing ticket reopen request functions
-- The previous migration (20260124200000) was incomplete - adding the 3 missing functions

-- Function 1: Get pending requests count (used by Layout.tsx for badge)
CREATE OR REPLACE FUNCTION public.get_pending_ticket_reopen_requests_count(p_store_id uuid)
RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer FROM public.ticket_reopen_requests
    WHERE store_id = p_store_id AND status = 'pending'
  );
END;
$$;

-- Function 2: Check if pending request exists (used by TicketEditor.tsx)
CREATE OR REPLACE FUNCTION public.has_pending_ticket_reopen_request(p_ticket_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.ticket_reopen_requests
    WHERE ticket_id = p_ticket_id AND status = 'pending'
  );
END;
$$;

-- Function 3: Create reopen request (used by TicketEditor.tsx)
CREATE OR REPLACE FUNCTION public.create_ticket_reopen_request(
  p_ticket_id uuid,
  p_reason_comment text,
  p_requested_changes_description text,
  p_created_by_employee_id uuid
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket RECORD;
  v_employee RECORD;
  v_request_id uuid;
BEGIN
  -- Validate inputs
  IF p_reason_comment IS NULL OR trim(p_reason_comment) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is required');
  END IF;

  IF p_requested_changes_description IS NULL OR trim(p_requested_changes_description) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Description of changes is required');
  END IF;

  -- Validate employee exists and has correct role
  SELECT * INTO v_employee FROM public.employees WHERE id = p_created_by_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Only Receptionist or Supervisor can create requests (not those who can reopen)
  IF v_employee.role_permission NOT IN ('Receptionist', 'Supervisor') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Receptionists and Supervisors can request ticket changes');
  END IF;

  -- Validate ticket exists and is closed
  SELECT * INTO v_ticket FROM public.sale_tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  IF v_ticket.closed_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only request changes for closed tickets');
  END IF;

  -- Check for existing pending request
  IF public.has_pending_ticket_reopen_request(p_ticket_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A pending request already exists for this ticket');
  END IF;

  -- Create the request
  INSERT INTO public.ticket_reopen_requests (
    ticket_id, store_id, reason_comment, requested_changes_description, created_by_employee_id
  ) VALUES (
    p_ticket_id, v_ticket.store_id, trim(p_reason_comment),
    trim(p_requested_changes_description), p_created_by_employee_id
  ) RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';
