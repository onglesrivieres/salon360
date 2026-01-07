-- ============================================================================
-- CASH TRANSACTION CHANGE PROPOSAL FUNCTIONS
-- ============================================================================
-- RPC functions for managing cash transaction change proposals
-- ============================================================================

-- Function 1: Check if a transaction has a pending change proposal
CREATE OR REPLACE FUNCTION public.has_pending_cash_transaction_change_proposal(
  p_cash_transaction_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.cash_transaction_change_proposals
    WHERE cash_transaction_id = p_cash_transaction_id
      AND status = 'pending'
  );
END;
$$;

-- Function 2: Create a new change proposal
CREATE OR REPLACE FUNCTION public.create_cash_transaction_change_proposal(
  p_cash_transaction_id uuid,
  p_proposed_amount decimal DEFAULT NULL,
  p_proposed_category text DEFAULT NULL,
  p_proposed_description text DEFAULT NULL,
  p_proposed_date date DEFAULT NULL,
  p_is_deletion_request boolean DEFAULT false,
  p_reason_comment text DEFAULT NULL,
  p_created_by_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction RECORD;
  v_employee RECORD;
  v_proposal_id uuid;
BEGIN
  -- Validate reason is provided
  IF p_reason_comment IS NULL OR trim(p_reason_comment) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is required');
  END IF;

  -- Validate at least one change or deletion
  IF NOT p_is_deletion_request AND
     p_proposed_amount IS NULL AND
     p_proposed_category IS NULL AND
     p_proposed_description IS NULL AND
     p_proposed_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least one change or deletion is required');
  END IF;

  -- Validate creator employee exists and is Manager
  SELECT * INTO v_employee
  FROM public.employees
  WHERE id = p_created_by_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  IF NOT ('Manager' = ANY(v_employee.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Managers can create change proposals');
  END IF;

  -- Validate transaction exists and is approved
  SELECT * INTO v_transaction
  FROM public.cash_transactions
  WHERE id = p_cash_transaction_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  IF v_transaction.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only request changes to approved transactions');
  END IF;

  -- Check for existing pending proposal
  IF public.has_pending_cash_transaction_change_proposal(p_cash_transaction_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A pending change request already exists for this transaction');
  END IF;

  -- Create the proposal
  INSERT INTO public.cash_transaction_change_proposals (
    cash_transaction_id,
    store_id,
    current_amount,
    current_category,
    current_description,
    "current_date",
    proposed_amount,
    proposed_category,
    proposed_description,
    proposed_date,
    is_deletion_request,
    reason_comment,
    created_by_employee_id
  )
  VALUES (
    p_cash_transaction_id,
    v_transaction.store_id,
    v_transaction.amount,
    v_transaction.category,
    v_transaction.description,
    v_transaction.date,
    p_proposed_amount,
    p_proposed_category,
    p_proposed_description,
    p_proposed_date,
    p_is_deletion_request,
    trim(p_reason_comment),
    p_created_by_employee_id
  )
  RETURNING id INTO v_proposal_id;

  RETURN jsonb_build_object(
    'success', true,
    'proposal_id', v_proposal_id
  );
END;
$$;

-- Function 3: Get pending change proposals for a store
CREATE OR REPLACE FUNCTION public.get_pending_cash_transaction_change_proposals(
  p_store_id uuid
)
RETURNS TABLE (
  proposal_id uuid,
  cash_transaction_id uuid,
  transaction_type text,
  current_amount decimal,
  current_category text,
  current_description text,
  "current_date" date,
  proposed_amount decimal,
  proposed_category text,
  proposed_description text,
  proposed_date date,
  is_deletion_request boolean,
  reason_comment text,
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
    p.id AS proposal_id,
    p.cash_transaction_id,
    ct.transaction_type::text,
    p.current_amount,
    p.current_category,
    p.current_description,
    p."current_date",
    p.proposed_amount,
    p.proposed_category,
    p.proposed_description,
    p.proposed_date,
    p.is_deletion_request,
    p.reason_comment,
    COALESCE(e.display_name, e.legal_name, 'Unknown') AS created_by_name,
    p.created_by_employee_id AS created_by_id,
    p.created_at
  FROM public.cash_transaction_change_proposals p
  INNER JOIN public.cash_transactions ct ON ct.id = p.cash_transaction_id
  INNER JOIN public.employees e ON e.id = p.created_by_employee_id
  WHERE p.store_id = p_store_id
    AND p.status = 'pending'
  ORDER BY p.created_at DESC;
END;
$$;

-- Function 4: Approve a change proposal
CREATE OR REPLACE FUNCTION public.approve_cash_transaction_change_proposal(
  p_proposal_id uuid,
  p_reviewer_employee_id uuid,
  p_review_comment text DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_proposal RECORD;
  v_reviewer RECORD;
BEGIN
  -- Validate reviewer exists and is Owner or Admin
  SELECT * INTO v_reviewer
  FROM public.employees
  WHERE id = p_reviewer_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found');
  END IF;

  IF NOT ('Owner' = ANY(v_reviewer.role) OR v_reviewer.role_permission = 'Admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Owners or Admins can approve change proposals');
  END IF;

  -- Get the proposal
  SELECT * INTO v_proposal
  FROM public.cash_transaction_change_proposals
  WHERE id = p_proposal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal not found');
  END IF;

  IF v_proposal.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal has already been reviewed');
  END IF;

  -- Handle deletion request
  IF v_proposal.is_deletion_request THEN
    -- Delete the transaction
    DELETE FROM public.cash_transactions
    WHERE id = v_proposal.cash_transaction_id;
  ELSE
    -- Update the transaction with proposed values
    UPDATE public.cash_transactions
    SET
      amount = COALESCE(v_proposal.proposed_amount, amount),
      category = COALESCE(v_proposal.proposed_category, category),
      description = COALESCE(v_proposal.proposed_description, description),
      date = COALESCE(v_proposal.proposed_date, date),
      last_edited_by_id = p_reviewer_employee_id,
      last_edited_at = now(),
      updated_at = now()
    WHERE id = v_proposal.cash_transaction_id;
  END IF;

  -- Update the proposal status
  UPDATE public.cash_transaction_change_proposals
  SET
    status = 'approved',
    reviewed_by_employee_id = p_reviewer_employee_id,
    reviewed_at = now(),
    review_comment = NULLIF(trim(COALESCE(p_review_comment, '')), '')
  WHERE id = p_proposal_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE WHEN v_proposal.is_deletion_request
      THEN 'Transaction deleted successfully'
      ELSE 'Transaction updated successfully'
    END
  );
END;
$$;

-- Function 5: Reject a change proposal
CREATE OR REPLACE FUNCTION public.reject_cash_transaction_change_proposal(
  p_proposal_id uuid,
  p_reviewer_employee_id uuid,
  p_review_comment text
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_proposal RECORD;
  v_reviewer RECORD;
BEGIN
  -- Validate review comment is provided
  IF p_review_comment IS NULL OR trim(p_review_comment) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rejection reason is required');
  END IF;

  -- Validate reviewer exists and is Owner or Admin
  SELECT * INTO v_reviewer
  FROM public.employees
  WHERE id = p_reviewer_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found');
  END IF;

  IF NOT ('Owner' = ANY(v_reviewer.role) OR v_reviewer.role_permission = 'Admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Owners or Admins can reject change proposals');
  END IF;

  -- Get the proposal
  SELECT * INTO v_proposal
  FROM public.cash_transaction_change_proposals
  WHERE id = p_proposal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal not found');
  END IF;

  IF v_proposal.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal has already been reviewed');
  END IF;

  -- Update the proposal status
  UPDATE public.cash_transaction_change_proposals
  SET
    status = 'rejected',
    reviewed_by_employee_id = p_reviewer_employee_id,
    reviewed_at = now(),
    review_comment = trim(p_review_comment)
  WHERE id = p_proposal_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Change request rejected'
  );
END;
$$;

-- Function 6: Get count of pending change proposals for a store
CREATE OR REPLACE FUNCTION public.get_pending_cash_transaction_change_proposals_count(
  p_store_id uuid
)
RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM public.cash_transaction_change_proposals
    WHERE store_id = p_store_id
      AND status = 'pending'
  );
END;
$$;
