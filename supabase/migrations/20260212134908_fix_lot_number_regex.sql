-- Fix regex in generate_lot_number() and create_inventory_transaction_atomic()
--
-- The '\d+$' regex depends on standard_conforming_strings setting.
-- Replace with POSIX character class '[0-9]+$' which works regardless of SCS.
-- This fixes duplicate lot numbers (LOT-2026-001) on every approval.

-- ============================================================================
-- FIX 1: generate_lot_number() — lot number sequence extraction
-- ============================================================================
DROP FUNCTION IF EXISTS public.generate_lot_number(uuid, text);

CREATE OR REPLACE FUNCTION public.generate_lot_number(
  p_store_id uuid,
  p_supplier_code text DEFAULT NULL,
  p_offset int DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_sequence int;
  v_prefix text;
  v_lot_number text;
  v_lock_key bigint;
BEGIN
  -- Get current year
  v_year := to_char(now(), 'YYYY');

  -- Use supplier code if provided, otherwise use 'LOT'
  v_prefix := COALESCE(p_supplier_code, 'LOT');

  -- GLOBAL lock key (not per-store) - matches global UNIQUE constraint
  v_lock_key := hashtext(v_prefix || '-' || v_year || '-LOT');

  -- Acquire advisory lock for this prefix+year combination
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Query GLOBAL max (no store_id filter) and add offset for this item
  -- Use [0-9] instead of \d to avoid backslash escaping issues
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(lot_number FROM '[0-9]+$') AS integer
    )
  ), 0) + 1 + p_offset
  INTO v_sequence
  FROM public.inventory_purchase_lots
  WHERE lot_number LIKE v_prefix || '-' || v_year || '-%';

  -- Format: PREFIX-YYYY-NNN (e.g., LOT-2026-001)
  v_lot_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::text, 3, '0');

  RETURN v_lot_number;
END;
$$;

-- ============================================================================
-- FIX 2: create_inventory_transaction_atomic() — transaction number sequence
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
  p_destination_store_id uuid DEFAULT NULL
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

  -- Validate transfer-specific fields
  IF p_transaction_type = 'transfer' THEN
    IF p_destination_store_id IS NULL THEN
      RAISE EXCEPTION 'destination_store_id is required for transfers';
    END IF;
    IF p_destination_store_id = p_store_id THEN
      RAISE EXCEPTION 'destination_store_id must be different from source store';
    END IF;
  END IF;

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
    'pending',
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

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
