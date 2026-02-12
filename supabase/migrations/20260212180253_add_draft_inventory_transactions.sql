/*
  # Add Draft Status for Inventory Transactions

  ## Overview
  Adds 'draft' status to inventory transactions so users can save partially-filled
  transactions and resume editing later before submitting for approval.

  ## Changes

  ### Tables
  - `inventory_transactions` - Add 'draft' to status CHECK constraint

  ### Functions
  - `create_inventory_transaction_atomic` - Add p_status parameter (default 'pending');
    when 'draft', use placeholder transaction number and skip sequence lock
  - `update_draft_transaction` - New: update header fields of a draft transaction
  - `submit_draft_transaction` - New: transition draft to pending with real transaction number
  - `delete_draft_transaction` - New: delete a draft transaction owned by the caller

  ## Notes
  - Existing triggers (auto_approve, update_inventory, create_lots) all check for
    'pending' or 'approved' status, so drafts are safely ignored
  - get_pending_inventory_approvals filters WHERE status = 'pending', excluding drafts
*/

-- ============================================================================
-- 1. ADD 'draft' TO STATUS CHECK CONSTRAINT
-- ============================================================================

ALTER TABLE public.inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_status_check;
ALTER TABLE public.inventory_transactions ADD CONSTRAINT inventory_transactions_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected'));

-- ============================================================================
-- 2. MODIFY create_inventory_transaction_atomic() — add p_status parameter
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_inventory_transaction_atomic(
  p_store_id uuid,
  p_transaction_type text,
  p_requested_by_id uuid,
  p_recipient_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_invoice_reference text DEFAULT NULL,
  p_notes text DEFAULT '',
  p_requires_manager_approval boolean DEFAULT true,
  p_requires_recipient_approval boolean DEFAULT false,
  p_destination_store_id uuid DEFAULT NULL,
  p_status text DEFAULT 'pending'
)
RETURNS TABLE(
  id uuid,
  transaction_number text,
  store_id uuid,
  transaction_type text,
  requested_by_id uuid,
  recipient_id uuid,
  supplier_id uuid,
  invoice_reference text,
  notes text,
  status text,
  requires_manager_approval boolean,
  requires_recipient_approval boolean,
  manager_approved boolean,
  recipient_approved boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_date_str text;
  v_prefix text;
  v_next_num integer;
  v_transaction_number text;
  v_lock_key bigint;
  v_new_transaction record;
BEGIN
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'store_id cannot be null';
  END IF;

  IF p_requested_by_id IS NULL THEN
    RAISE EXCEPTION 'requested_by_id cannot be null';
  END IF;

  IF p_transaction_type NOT IN ('in', 'out', 'transfer') THEN
    RAISE EXCEPTION 'transaction_type must be in, out, or transfer';
  END IF;

  IF p_status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION 'status must be draft or pending';
  END IF;

  -- Validate transfer-specific fields (only for pending, drafts can be incomplete)
  IF p_transaction_type = 'transfer' AND p_status = 'pending' THEN
    IF p_destination_store_id IS NULL THEN
      RAISE EXCEPTION 'destination_store_id is required for transfers';
    END IF;
    IF p_destination_store_id = p_store_id THEN
      RAISE EXCEPTION 'destination_store_id must be different from source store';
    END IF;
  END IF;

  IF p_status = 'draft' THEN
    -- Drafts get a placeholder transaction number, no sequence lock needed
    v_transaction_number := 'DRAFT-' || gen_random_uuid();
  ELSE
    -- Pending transactions get a real sequential number
    v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    v_prefix := CASE
      WHEN p_transaction_type = 'in' THEN 'IN'
      WHEN p_transaction_type = 'out' THEN 'OUT'
      WHEN p_transaction_type = 'transfer' THEN 'XFER'
      ELSE 'TXN'
    END;

    -- Use GLOBAL lock (no store_id in lock key)
    v_lock_key := hashtext(v_prefix || '-' || v_date_str);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Query GLOBAL max sequence
    -- Use [0-9] instead of \d to avoid backslash escaping issues
    SELECT COALESCE(MAX(
      CAST(
        SUBSTRING(inventory_transactions.transaction_number FROM '[0-9]+$') AS INTEGER
      )
    ), 0) + 1
    INTO v_next_num
    FROM public.inventory_transactions
    WHERE inventory_transactions.transaction_number LIKE v_prefix || '-' || v_date_str || '-%';

    v_transaction_number := v_prefix || '-' || v_date_str || '-' || LPAD(v_next_num::text, 4, '0');
  END IF;

  INSERT INTO public.inventory_transactions (
    store_id,
    transaction_type,
    transaction_number,
    requested_by_id,
    recipient_id,
    supplier_id,
    invoice_reference,
    notes,
    status,
    requires_manager_approval,
    requires_recipient_approval,
    manager_approved,
    recipient_approved,
    destination_store_id,
    created_at,
    updated_at
  ) VALUES (
    p_store_id,
    p_transaction_type,
    v_transaction_number,
    p_requested_by_id,
    p_recipient_id,
    p_supplier_id,
    p_invoice_reference,
    p_notes,
    p_status,
    p_requires_manager_approval,
    p_requires_recipient_approval,
    false,
    false,
    p_destination_store_id,
    NOW(),
    NOW()
  )
  RETURNING * INTO v_new_transaction;

  RETURN QUERY SELECT
    v_new_transaction.id,
    v_new_transaction.transaction_number,
    v_new_transaction.store_id,
    v_new_transaction.transaction_type,
    v_new_transaction.requested_by_id,
    v_new_transaction.recipient_id,
    v_new_transaction.supplier_id,
    v_new_transaction.invoice_reference,
    v_new_transaction.notes,
    v_new_transaction.status,
    v_new_transaction.requires_manager_approval,
    v_new_transaction.requires_recipient_approval,
    v_new_transaction.manager_approved,
    v_new_transaction.recipient_approved,
    v_new_transaction.created_at,
    v_new_transaction.updated_at;
END;
$body$;

-- ============================================================================
-- 3. NEW RPC: update_draft_transaction()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_draft_transaction(
  p_transaction_id uuid,
  p_transaction_type text DEFAULT NULL,
  p_recipient_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_invoice_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_destination_store_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
BEGIN
  SELECT status INTO v_current_status
  FROM public.inventory_transactions
  WHERE id = p_transaction_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_current_status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft transactions can be updated. Current status: %', v_current_status;
  END IF;

  UPDATE public.inventory_transactions
  SET
    transaction_type = COALESCE(p_transaction_type, transaction_type),
    recipient_id = p_recipient_id,
    supplier_id = p_supplier_id,
    invoice_reference = p_invoice_reference,
    notes = COALESCE(p_notes, notes),
    destination_store_id = p_destination_store_id,
    updated_at = NOW()
  WHERE id = p_transaction_id;
END;
$$;

-- ============================================================================
-- 4. NEW RPC: submit_draft_transaction()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_draft_transaction(
  p_transaction_id uuid,
  p_requires_manager_approval boolean DEFAULT true,
  p_requires_recipient_approval boolean DEFAULT false
)
RETURNS TABLE(
  transaction_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current record;
  v_date_str text;
  v_prefix text;
  v_next_num integer;
  v_transaction_number text;
  v_lock_key bigint;
BEGIN
  SELECT * INTO v_current
  FROM public.inventory_transactions
  WHERE id = p_transaction_id;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_current.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft transactions can be submitted. Current status: %', v_current.status;
  END IF;

  -- Validate transfer-specific fields
  IF v_current.transaction_type = 'transfer' THEN
    IF v_current.destination_store_id IS NULL THEN
      RAISE EXCEPTION 'destination_store_id is required for transfers';
    END IF;
    IF v_current.destination_store_id = v_current.store_id THEN
      RAISE EXCEPTION 'destination_store_id must be different from source store';
    END IF;
  END IF;

  -- Generate a real transaction number (same logic as create RPC)
  v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  v_prefix := CASE
    WHEN v_current.transaction_type = 'in' THEN 'IN'
    WHEN v_current.transaction_type = 'out' THEN 'OUT'
    WHEN v_current.transaction_type = 'transfer' THEN 'XFER'
    ELSE 'TXN'
  END;

  v_lock_key := hashtext(v_prefix || '-' || v_date_str);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(it.transaction_number FROM '[0-9]+$') AS INTEGER
    )
  ), 0) + 1
  INTO v_next_num
  FROM public.inventory_transactions it
  WHERE it.transaction_number LIKE v_prefix || '-' || v_date_str || '-%';

  v_transaction_number := v_prefix || '-' || v_date_str || '-' || LPAD(v_next_num::text, 4, '0');

  UPDATE public.inventory_transactions
  SET
    transaction_number = v_transaction_number,
    status = 'pending',
    requires_manager_approval = p_requires_manager_approval,
    requires_recipient_approval = p_requires_recipient_approval,
    updated_at = NOW()
  WHERE id = p_transaction_id;

  RETURN QUERY SELECT v_transaction_number;
END;
$$;

-- ============================================================================
-- 5. NEW RPC: delete_draft_transaction()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_draft_transaction(
  p_transaction_id uuid,
  p_employee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current record;
BEGIN
  SELECT status, requested_by_id INTO v_current
  FROM public.inventory_transactions
  WHERE id = p_transaction_id;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_current.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft transactions can be deleted. Current status: %', v_current.status;
  END IF;

  IF v_current.requested_by_id <> p_employee_id THEN
    RAISE EXCEPTION 'Only the creator can delete a draft transaction';
  END IF;

  -- Delete items first, then the transaction
  DELETE FROM public.inventory_transaction_items
  WHERE transaction_id = p_transaction_id;

  DELETE FROM public.inventory_transactions
  WHERE id = p_transaction_id;
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.update_draft_transaction(uuid, text, uuid, uuid, text, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_draft_transaction(uuid, boolean, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_draft_transaction(uuid, uuid) TO anon, authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
