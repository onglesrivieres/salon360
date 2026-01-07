-- ============================================================================
-- FIX CASH TRANSACTION CHANGE PROPOSAL PERMISSIONS
-- ============================================================================
-- Updates the permission check to allow Admin, Manager, and Owner roles
-- to create change proposals (matching frontend permission)
-- ============================================================================

-- Update the create_cash_transaction_change_proposal function
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

  -- Validate creator employee exists and has appropriate role
  SELECT * INTO v_employee
  FROM public.employees
  WHERE id = p_created_by_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Allow Admin, Manager, or Owner to create change proposals
  IF NOT ('Manager' = ANY(v_employee.role) OR 'Admin' = ANY(v_employee.role) OR 'Owner' = ANY(v_employee.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Managers, Admins, and Owners can create change proposals');
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
