-- Fix ticket reopen request RPCs that reference dropped column `role_permission`
-- The employees table now uses a `role` text array instead.
-- Also adds Cashier to create_ticket_reopen_request to match frontend permissions.

-- 1. Fix create_ticket_reopen_request: role_permission → role array, add Cashier
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

  -- Only Receptionist, Supervisor, or Cashier can create requests (not those who can directly reopen)
  IF NOT ('Receptionist' = ANY(v_employee.role) OR 'Supervisor' = ANY(v_employee.role) OR 'Cashier' = ANY(v_employee.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Receptionists, Supervisors, and Cashiers can request ticket changes');
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

-- 2. Fix approve_ticket_reopen_request: role_permission → role array
CREATE OR REPLACE FUNCTION public.approve_ticket_reopen_request(
  p_request_id uuid,
  p_reviewer_employee_id uuid,
  p_review_comment text DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_request RECORD;
  v_reviewer RECORD;
BEGIN
  -- Validate reviewer has permission
  SELECT * INTO v_reviewer FROM public.employees WHERE id = p_reviewer_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found');
  END IF;

  IF NOT ('Admin' = ANY(v_reviewer.role) OR 'Owner' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Managers, Owners, or Admins can approve reopen requests');
  END IF;

  -- Get and validate request
  SELECT * INTO v_request FROM public.ticket_reopen_requests WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request has already been reviewed');
  END IF;

  -- Update request status (does NOT auto-reopen the ticket)
  UPDATE public.ticket_reopen_requests SET
    status = 'approved',
    reviewed_by_employee_id = p_reviewer_employee_id,
    reviewed_at = now(),
    review_comment = NULLIF(trim(COALESCE(p_review_comment, '')), '')
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Request approved. You can now reopen the ticket.',
    'ticket_id', v_request.ticket_id
  );
END;
$$;

-- 3. Fix reject_ticket_reopen_request: role_permission → role array
CREATE OR REPLACE FUNCTION public.reject_ticket_reopen_request(
  p_request_id uuid,
  p_reviewer_employee_id uuid,
  p_review_comment text
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_request RECORD;
  v_reviewer RECORD;
BEGIN
  IF p_review_comment IS NULL OR trim(p_review_comment) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rejection reason is required');
  END IF;

  -- Validate reviewer
  SELECT * INTO v_reviewer FROM public.employees WHERE id = p_reviewer_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found');
  END IF;

  IF NOT ('Admin' = ANY(v_reviewer.role) OR 'Owner' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Managers, Owners, or Admins can reject reopen requests');
  END IF;

  -- Get and validate request
  SELECT * INTO v_request FROM public.ticket_reopen_requests WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request has already been reviewed');
  END IF;

  UPDATE public.ticket_reopen_requests SET
    status = 'rejected',
    reviewed_by_employee_id = p_reviewer_employee_id,
    reviewed_at = now(),
    review_comment = trim(p_review_comment)
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Request rejected');
END;
$$;
