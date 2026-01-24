/*
  # Fix Transaction Change Approval Functions

  The role_permission column was removed from employees table.
  These functions need to check the role[] array instead.

  Fixes:
  - approve_cash_transaction_change_proposal() - was using v_reviewer.role_permission
  - reject_cash_transaction_change_proposal() - was using v_reviewer.role_permission
*/

-- Function: Approve a change proposal (fixed role check)
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
  -- Validate reviewer exists and is Owner, Admin, or Manager
  SELECT * INTO v_reviewer
  FROM public.employees
  WHERE id = p_reviewer_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found');
  END IF;

  -- Check role array instead of removed role_permission column
  IF NOT ('Owner' = ANY(v_reviewer.role) OR 'Admin' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role)) THEN
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

-- Function: Reject a change proposal (fixed role check)
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

  -- Validate reviewer exists and is Owner, Admin, or Manager
  SELECT * INTO v_reviewer
  FROM public.employees
  WHERE id = p_reviewer_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found');
  END IF;

  -- Check role array instead of removed role_permission column
  IF NOT ('Owner' = ANY(v_reviewer.role) OR 'Admin' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role)) THEN
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
