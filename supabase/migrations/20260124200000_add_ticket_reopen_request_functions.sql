-- Migration: Add missing ticket reopen request functions
-- These functions were defined in the archived migration but not included in the squash

-- Function 1: Get pending requests for a store (used by PendingApprovalsPage Ticket Changes tab)
CREATE OR REPLACE FUNCTION public.get_pending_ticket_reopen_requests(p_store_id uuid)
RETURNS TABLE (
  request_id uuid,
  ticket_id uuid,
  ticket_no text,
  ticket_date date,
  customer_name text,
  total decimal,
  closed_at timestamptz,
  reason_comment text,
  requested_changes_description text,
  created_by_name text,
  created_by_id uuid,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id AS request_id,
    r.ticket_id,
    t.ticket_no,
    t.ticket_date,
    t.customer_name,
    t.total,
    t.closed_at,
    r.reason_comment,
    r.requested_changes_description,
    COALESCE(e.display_name, e.legal_name, 'Unknown') AS created_by_name,
    r.created_by_employee_id AS created_by_id,
    r.created_at
  FROM public.ticket_reopen_requests r
  INNER JOIN public.sale_tickets t ON t.id = r.ticket_id
  INNER JOIN public.employees e ON e.id = r.created_by_employee_id
  WHERE r.store_id = p_store_id AND r.status = 'pending'
  ORDER BY r.created_at DESC;
END;
$$;

-- Function 2: Approve request (marks as approved, reviewer then manually reopens)
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

  IF NOT (v_reviewer.role_permission = 'Admin' OR 'Owner' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role)) THEN
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

-- Function 3: Reject request
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

  IF NOT (v_reviewer.role_permission = 'Admin' OR 'Owner' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role)) THEN
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

-- Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';
