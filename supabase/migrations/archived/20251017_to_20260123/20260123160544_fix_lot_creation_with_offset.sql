/*
  # Fix Lot Creation with Offset Parameter

  ## Problem
  Previous fix attempts failed:
  1. Migration 20260123154656: Added pg_advisory_xact_lock but didn't solve the issue
  2. Migration 20260123160120: Used nested LOOP with EXCEPTION which caused syntax error

  The root cause: when a transaction has multiple items, generate_lot_number() is called
  multiple times in the same transaction. Even with advisory locks, both calls see the
  same MAX value and generate the same lot number.

  ## Solution
  Add an offset parameter to generate_lot_number(). Each item in the loop uses a different
  offset (0, 1, 2...) to ensure unique sequential lot numbers:
  - Item 1: generate_lot_number(store, NULL, 0) → LOT-2026-001
  - Item 2: generate_lot_number(store, NULL, 1) → LOT-2026-002
  - Item 3: generate_lot_number(store, NULL, 2) → LOT-2026-003

  ## Changes
  - Update generate_lot_number() to accept optional p_offset parameter (default 0)
  - Update create_lots_from_approved_transaction() to pass item index as offset
*/

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Step 0: Drop old 2-parameter version to avoid function overloading conflict
DROP FUNCTION IF EXISTS public.generate_lot_number(uuid, text);

-- Step 1: Create generate_lot_number with offset parameter
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

  -- Query GLOBAL max and add offset for this item
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(lot_number FROM '\\d+$') AS integer
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

-- Step 2: Update trigger function to use offset for each item
CREATE OR REPLACE FUNCTION public.create_lots_from_approved_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_item record;
  v_lot_id uuid;
  v_lot_number text;
  v_supplier_id uuid;
  v_invoice_ref text;
  v_item_index int := 0;
BEGIN
  -- Only process IN transactions that just got approved
  IF NEW.transaction_type = 'in'
     AND NEW.status = 'approved'
     AND (OLD.status IS NULL OR OLD.status != 'approved')
     AND NEW.manager_approved = true
  THEN
    -- Get supplier and invoice reference from transaction
    v_supplier_id := NEW.supplier_id;
    v_invoice_ref := NEW.invoice_reference;

    -- Process each transaction item with consistent ordering
    FOR v_transaction_item IN
      SELECT
        ti.id,
        ti.item_id,
        ti.quantity,
        ti.unit_cost,
        ti.purchase_unit_id,
        ti.purchase_quantity,
        ti.purchase_unit_multiplier,
        ti.notes,
        ii.store_id
      FROM public.inventory_transaction_items ti
      JOIN public.inventory_items ii ON ii.id = ti.item_id
      WHERE ti.transaction_id = NEW.id
      ORDER BY ti.id  -- Ensure consistent ordering
    LOOP
      -- Generate lot number with offset for this item
      -- Each item gets offset 0, 1, 2, etc. to ensure unique sequential numbers
      v_lot_number := public.generate_lot_number(
        v_transaction_item.store_id,
        NULL,
        v_item_index
      );
      v_item_index := v_item_index + 1;

      -- Create purchase lot
      INSERT INTO public.inventory_purchase_lots (
        lot_number,
        store_id,
        item_id,
        supplier_id,
        quantity_received,
        quantity_remaining,
        unit_cost,
        purchase_date,
        invoice_reference,
        notes,
        status,
        created_by_id,
        created_at,
        updated_at
      ) VALUES (
        v_lot_number,
        v_transaction_item.store_id,
        v_transaction_item.item_id,
        v_supplier_id,
        v_transaction_item.quantity,
        v_transaction_item.quantity,
        v_transaction_item.unit_cost,
        NEW.created_at,
        v_invoice_ref,
        CASE
          WHEN v_transaction_item.purchase_quantity IS NOT NULL THEN
            'Purchased: ' || v_transaction_item.purchase_quantity || ' units at multiplier ' || v_transaction_item.purchase_unit_multiplier || '. ' || COALESCE(v_transaction_item.notes, '')
          ELSE
            v_transaction_item.notes
        END,
        'active',
        NEW.requested_by_id,
        now(),
        now()
      )
      RETURNING id INTO v_lot_id;

      -- Update transaction item with the created lot_id
      UPDATE public.inventory_transaction_items
      SET lot_id = v_lot_id
      WHERE id = v_transaction_item.id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.generate_lot_number(uuid, text, int) IS
  'Generates sequential lot numbers with format PREFIX-YYYY-NNN. Uses pg_advisory_xact_lock
   to prevent race conditions. Accepts optional p_offset parameter for generating multiple
   sequential numbers in a single transaction. Fixed in 20260123160544.';

COMMENT ON FUNCTION public.create_lots_from_approved_transaction IS
  'Creates purchase lots when inventory IN transactions are approved. Uses offset parameter
   in generate_lot_number to ensure unique sequential lot numbers for multiple items.
   Uses item_id (NOT master_item_id). Fixed in 20260123160544.';

-- ============================================================================
-- SCHEMA CACHE RELOAD
-- ============================================================================

NOTIFY pgrst, 'reload schema';
