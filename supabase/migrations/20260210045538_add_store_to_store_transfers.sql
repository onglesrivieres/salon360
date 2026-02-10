-- ============================================================================
-- Migration: Add Store-to-Store Inventory Transfers
-- Description: Adds transfer transaction type, destination_store_id,
--   received_quantity for partial receipts, and updates RPCs/triggers
-- ============================================================================

-- 1. Add destination_store_id to inventory_transactions
ALTER TABLE public.inventory_transactions
  ADD COLUMN IF NOT EXISTS destination_store_id uuid REFERENCES public.stores(id);

-- 2. Add received_quantity to inventory_transaction_items (for partial receipt)
ALTER TABLE public.inventory_transaction_items
  ADD COLUMN IF NOT EXISTS received_quantity numeric(10,2);

-- 3. Update transaction_type CHECK constraint to allow 'transfer'
DO $$
BEGIN
  -- Drop existing constraint
  ALTER TABLE public.inventory_transactions
    DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

  -- Add updated constraint
  ALTER TABLE public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_transaction_type_check
    CHECK (transaction_type IN ('in', 'out', 'transfer'));
END $$;

-- 4. Index on destination_store_id for transfer lookups
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_destination_store_id
  ON public.inventory_transactions(destination_store_id)
  WHERE destination_store_id IS NOT NULL;

-- ============================================================================
-- 5. Update create_inventory_transaction_atomic() RPC
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
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(inventory_transactions.transaction_number FROM '\d+$') AS INTEGER
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

-- ============================================================================
-- 6. Update update_inventory_on_transaction_approval() trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_inventory_on_transaction_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    FOR v_item IN
      SELECT item_id, quantity, received_quantity
      FROM public.inventory_transaction_items
      WHERE transaction_id = NEW.id
    LOOP
      IF NEW.transaction_type = 'in' THEN
        UPDATE public.store_inventory_levels
          SET quantity_on_hand = quantity_on_hand + v_item.quantity,
              updated_at = now()
          WHERE store_id = NEW.store_id AND item_id = v_item.item_id;

      ELSIF NEW.transaction_type = 'out' THEN
        UPDATE public.store_inventory_levels
          SET quantity_on_hand = quantity_on_hand - v_item.quantity,
              updated_at = now()
          WHERE store_id = NEW.store_id AND item_id = v_item.item_id;

      ELSIF NEW.transaction_type = 'transfer' THEN
        -- For transfers: deduct from source, add to destination
        -- Use received_quantity if set (partial receipt), otherwise full quantity
        UPDATE public.store_inventory_levels
          SET quantity_on_hand = quantity_on_hand - COALESCE(v_item.received_quantity, v_item.quantity),
              updated_at = now()
          WHERE store_id = NEW.store_id AND item_id = v_item.item_id;

        -- Add to destination store (insert if level doesn't exist)
        INSERT INTO public.store_inventory_levels (store_id, item_id, quantity_on_hand, unit_cost, reorder_level, is_active, created_at, updated_at)
        VALUES (NEW.destination_store_id, v_item.item_id, COALESCE(v_item.received_quantity, v_item.quantity), 0, 0, true, now(), now())
        ON CONFLICT (store_id, item_id)
        DO UPDATE SET
          quantity_on_hand = store_inventory_levels.quantity_on_hand + COALESCE(v_item.received_quantity, v_item.quantity),
          updated_at = now();
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 7. Update get_pending_inventory_approvals() RPC
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_pending_inventory_approvals(uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_pending_inventory_approvals(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS TABLE (
  id uuid,
  transaction_number text,
  transaction_type text,
  requested_by_id uuid,
  requested_by_name text,
  recipient_id uuid,
  recipient_name text,
  notes text,
  status text,
  requires_recipient_approval boolean,
  requires_manager_approval boolean,
  recipient_approved boolean,
  manager_approved boolean,
  created_at timestamptz,
  item_count bigint,
  total_value numeric,
  destination_store_id uuid,
  destination_store_name text,
  source_store_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_roles text[];
  v_is_manager boolean;
BEGIN
  SELECT e.role INTO v_employee_roles
  FROM public.employees e
  WHERE e.id = p_employee_id;

  v_is_manager := 'Admin' = ANY(v_employee_roles)
               OR 'Manager' = ANY(v_employee_roles)
               OR 'Owner' = ANY(v_employee_roles);

  RETURN QUERY
  SELECT
    it.id,
    it.transaction_number,
    it.transaction_type,
    it.requested_by_id,
    req.display_name as requested_by_name,
    it.recipient_id,
    COALESCE(rec.display_name, '') as recipient_name,
    it.notes,
    it.status,
    it.requires_recipient_approval,
    it.requires_manager_approval,
    it.recipient_approved,
    it.manager_approved,
    it.created_at,
    COUNT(iti.id) as item_count,
    SUM(iti.quantity * iti.unit_cost) as total_value,
    it.destination_store_id,
    COALESCE(dst.name, '') as destination_store_name,
    src.name as source_store_name
  FROM public.inventory_transactions it
  JOIN public.employees req ON req.id = it.requested_by_id
  LEFT JOIN public.employees rec ON rec.id = it.recipient_id
  LEFT JOIN public.inventory_transaction_items iti ON iti.transaction_id = it.id
  LEFT JOIN public.stores dst ON dst.id = it.destination_store_id
  JOIN public.stores src ON src.id = it.store_id
  WHERE it.status = 'pending'
    AND (
      -- Original store-based conditions
      (
        it.store_id = p_store_id
        AND (
          (v_is_manager AND it.requires_manager_approval AND NOT it.manager_approved)
          OR
          (it.recipient_id = p_employee_id AND it.requires_recipient_approval AND NOT it.recipient_approved)
        )
      )
      OR
      -- Transfers where this store is the destination (destination manager approves)
      (
        it.transaction_type = 'transfer'
        AND it.destination_store_id = p_store_id
        AND v_is_manager
        AND NOT it.manager_approved
      )
    )
  GROUP BY it.id, it.transaction_number, it.transaction_type, it.requested_by_id, req.display_name,
           it.recipient_id, rec.display_name, it.notes, it.status, it.requires_recipient_approval,
           it.requires_manager_approval, it.recipient_approved, it.manager_approved, it.created_at,
           it.destination_store_id, dst.name, src.name
  ORDER BY it.created_at DESC;
END;
$$;

-- ============================================================================
-- 8. New RPC: approve_inventory_transfer() with partial receipt support
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_inventory_transfer(
  p_transaction_id uuid,
  p_employee_id uuid,
  p_received_items jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction record;
  v_received_item jsonb;
  v_item_id uuid;
  v_received_qty numeric(10,2);
BEGIN
  -- Fetch the transaction
  SELECT * INTO v_transaction
  FROM public.inventory_transactions
  WHERE id = p_transaction_id;

  IF v_transaction IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_transaction.transaction_type != 'transfer' THEN
    RAISE EXCEPTION 'This RPC is only for transfer transactions';
  END IF;

  IF v_transaction.status != 'pending' THEN
    RAISE EXCEPTION 'Transaction is not pending';
  END IF;

  IF v_transaction.requested_by_id = p_employee_id THEN
    RAISE EXCEPTION 'You cannot approve transfers you created';
  END IF;

  -- Update received_quantity on items if partial receipt data provided
  IF p_received_items IS NOT NULL THEN
    FOR v_received_item IN SELECT * FROM jsonb_array_elements(p_received_items)
    LOOP
      v_item_id := (v_received_item->>'item_id')::uuid;
      v_received_qty := (v_received_item->>'received_quantity')::numeric(10,2);

      UPDATE public.inventory_transaction_items
        SET received_quantity = v_received_qty
        WHERE transaction_id = p_transaction_id
          AND item_id = v_item_id;
    END LOOP;
  END IF;

  -- Approve the transaction (triggers update_inventory_on_transaction_approval)
  UPDATE public.inventory_transactions
    SET status = 'approved',
        manager_approved = true,
        manager_approved_at = NOW(),
        manager_approved_by_id = p_employee_id,
        updated_at = NOW()
    WHERE id = p_transaction_id;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
