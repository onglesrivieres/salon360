-- Fix: Create ticket_reopen_requests table and RPC functions on salon365
-- This table/functions existed on salon360qc but were never applied to salon365.
-- All statements are idempotent so this is safe to run on both databases.

-- ============================================================================
-- TABLE: ticket_reopen_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ticket_reopen_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.sale_tickets(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reason_comment text NOT NULL,
  requested_changes_description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewed_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_reopen_requests_ticket ON public.ticket_reopen_requests(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_reopen_requests_store ON public.ticket_reopen_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_ticket_reopen_requests_status ON public.ticket_reopen_requests(status);

ALTER TABLE public.ticket_reopen_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to ticket_reopen_requests" ON public.ticket_reopen_requests;
CREATE POLICY "Allow all access to ticket_reopen_requests"
  ON public.ticket_reopen_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- FUNCTION 1: has_pending_ticket_reopen_request
-- Used by TicketEditor to check if a pending request already exists
-- (Defined first because create_ticket_reopen_request calls it)
-- ============================================================================
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

-- ============================================================================
-- FUNCTION 2: create_ticket_reopen_request
-- Used by TicketEditor for Receptionist/Supervisor/Cashier to request changes
-- (Latest version from 20260206000001: uses role array, includes Cashier)
-- ============================================================================
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

-- ============================================================================
-- FUNCTION 3: approve_ticket_reopen_request
-- Used by PendingApprovalsPage for Manager/Owner/Admin to approve
-- (Latest version from 20260206000001: uses role array)
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

-- ============================================================================
-- FUNCTION 4: reject_ticket_reopen_request
-- Used by PendingApprovalsPage for Manager/Owner/Admin to reject
-- (Latest version from 20260206000001: uses role array)
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

-- ============================================================================
-- FUNCTION 5: get_pending_ticket_reopen_requests
-- Used by PendingApprovalsPage Ticket Changes tab
-- ============================================================================
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

-- ============================================================================
-- FUNCTION 6: get_pending_ticket_reopen_requests_count
-- Used by Layout.tsx for the pending approvals badge count
-- ============================================================================
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

-- Force PostgREST schema cache refresh
NOTIFY pgrst, 'reload schema';
