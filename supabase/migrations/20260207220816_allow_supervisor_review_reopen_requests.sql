-- Allow Supervisors to review (approve/reject) ticket reopen requests
-- from Receptionists and Cashiers. Supervisor-created requests remain Manager+ only.
-- All statements are idempotent (CREATE OR REPLACE, DROP + CREATE).

-- ============================================================================
-- FUNCTION 1: approve_ticket_reopen_request
-- Now allows Supervisor with guards: no self-approval, only for Receptionist/Cashier requests
-- ============================================================================
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
  v_creator RECORD;
  v_reviewer_is_supervisor_only boolean;
BEGIN
  -- Validate reviewer has permission
  SELECT * INTO v_reviewer FROM public.employees WHERE id = p_reviewer_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found');
  END IF;

  -- Allow Admin, Owner, Manager, or Supervisor
  IF NOT ('Admin' = ANY(v_reviewer.role) OR 'Owner' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role) OR 'Supervisor' = ANY(v_reviewer.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Supervisors, Managers, Owners, or Admins can approve reopen requests');
  END IF;

  -- Get and validate request
  SELECT * INTO v_request FROM public.ticket_reopen_requests WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request has already been reviewed');
  END IF;

  -- Block self-approval: reviewer cannot approve their own request
  IF v_request.created_by_employee_id = p_reviewer_employee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot approve your own request');
  END IF;

  -- Supervisor-only guard: can only approve requests from Receptionist or Cashier
  v_reviewer_is_supervisor_only := 'Supervisor' = ANY(v_reviewer.role)
    AND NOT ('Admin' = ANY(v_reviewer.role) OR 'Owner' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role));

  IF v_reviewer_is_supervisor_only THEN
    SELECT * INTO v_creator FROM public.employees WHERE id = v_request.created_by_employee_id;
    IF NOT FOUND OR NOT ('Receptionist' = ANY(v_creator.role) OR 'Cashier' = ANY(v_creator.role)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Supervisors can only approve requests from Receptionists or Cashiers');
    END IF;
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

-- ============================================================================
-- FUNCTION 2: reject_ticket_reopen_request
-- Now allows Supervisor with same guards as approve
-- ============================================================================
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
  v_creator RECORD;
  v_reviewer_is_supervisor_only boolean;
BEGIN
  IF p_review_comment IS NULL OR trim(p_review_comment) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rejection reason is required');
  END IF;

  -- Validate reviewer
  SELECT * INTO v_reviewer FROM public.employees WHERE id = p_reviewer_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found');
  END IF;

  -- Allow Admin, Owner, Manager, or Supervisor
  IF NOT ('Admin' = ANY(v_reviewer.role) OR 'Owner' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role) OR 'Supervisor' = ANY(v_reviewer.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Supervisors, Managers, Owners, or Admins can reject reopen requests');
  END IF;

  -- Get and validate request
  SELECT * INTO v_request FROM public.ticket_reopen_requests WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request has already been reviewed');
  END IF;

  -- Block self-rejection: reviewer cannot reject their own request
  IF v_request.created_by_employee_id = p_reviewer_employee_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot reject your own request');
  END IF;

  -- Supervisor-only guard: can only reject requests from Receptionist or Cashier
  v_reviewer_is_supervisor_only := 'Supervisor' = ANY(v_reviewer.role)
    AND NOT ('Admin' = ANY(v_reviewer.role) OR 'Owner' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role));

  IF v_reviewer_is_supervisor_only THEN
    SELECT * INTO v_creator FROM public.employees WHERE id = v_request.created_by_employee_id;
    IF NOT FOUND OR NOT ('Receptionist' = ANY(v_creator.role) OR 'Cashier' = ANY(v_creator.role)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Supervisors can only reject requests from Receptionists or Cashiers');
    END IF;
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

-- ============================================================================
-- FUNCTION 3: get_pending_ticket_reopen_requests
-- Added created_by_roles column so frontend can filter by creator role
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_pending_ticket_reopen_requests(uuid);

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
  created_at timestamptz,
  created_by_roles text[]
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
    r.created_at,
    e.role AS created_by_roles
  FROM public.ticket_reopen_requests r
  INNER JOIN public.sale_tickets t ON t.id = r.ticket_id
  INNER JOIN public.employees e ON e.id = r.created_by_employee_id
  WHERE r.store_id = p_store_id AND r.status = 'pending'
  ORDER BY r.created_at DESC;
END;
$$;

-- ============================================================================
-- FUNCTION 4: get_pending_ticket_reopen_requests_count
-- Added optional p_reviewer_employee_id for Supervisor-aware counting
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_ticket_reopen_requests_count(
  p_store_id uuid,
  p_reviewer_employee_id uuid DEFAULT NULL
)
RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_reviewer RECORD;
  v_reviewer_is_supervisor_only boolean;
BEGIN
  -- If no reviewer specified, return full count (backwards-compatible)
  IF p_reviewer_employee_id IS NULL THEN
    RETURN (
      SELECT COUNT(*)::integer FROM public.ticket_reopen_requests
      WHERE store_id = p_store_id AND status = 'pending'
    );
  END IF;

  -- Check if reviewer is Supervisor-only (not also Manager/Owner/Admin)
  SELECT * INTO v_reviewer FROM public.employees WHERE id = p_reviewer_employee_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_reviewer_is_supervisor_only := 'Supervisor' = ANY(v_reviewer.role)
    AND NOT ('Admin' = ANY(v_reviewer.role) OR 'Owner' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role));

  IF v_reviewer_is_supervisor_only THEN
    -- Only count requests from Receptionists or Cashiers
    RETURN (
      SELECT COUNT(*)::integer
      FROM public.ticket_reopen_requests r
      INNER JOIN public.employees e ON e.id = r.created_by_employee_id
      WHERE r.store_id = p_store_id
        AND r.status = 'pending'
        AND ('Receptionist' = ANY(e.role) OR 'Cashier' = ANY(e.role))
    );
  END IF;

  -- For Manager/Owner/Admin, return full count
  RETURN (
    SELECT COUNT(*)::integer FROM public.ticket_reopen_requests
    WHERE store_id = p_store_id AND status = 'pending'
  );
END;
$$;

-- Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';
