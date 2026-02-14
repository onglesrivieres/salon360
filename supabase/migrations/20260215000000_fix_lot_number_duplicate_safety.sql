-- Fix lot creation in AFTER trigger — batch sequence approach
--
-- Root cause: create_lots_from_approved_transaction() calls generate_lot_number()
-- per item inside an AFTER trigger. Due to snapshot isolation, SELECT MAX(...)
-- returns the same stale value for every iteration — it never sees lots inserted
-- by prior iterations within the same trigger invocation. This causes duplicate
-- lot numbers when approving transactions with many items.
--
-- Fix: Query MAX once at the top, acquire advisory lock, then compute all lot
-- numbers as base_sequence + item_index. No per-item function calls, no per-item
-- savepoints, no retry loops.
--
-- generate_lot_number() is left unchanged — still available for standalone lot
-- creation outside of bulk triggers.

-- ============================================================================
-- generate_lot_number() — unchanged from regex fix migration, kept here for
-- completeness since this migration replaces the previous version of this file
-- ============================================================================
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
  v_year := to_char(now(), 'YYYY');
  v_prefix := COALESCE(p_supplier_code, 'LOT');

  -- GLOBAL lock key (not per-store) - matches global UNIQUE constraint
  v_lock_key := hashtext(v_prefix || '-' || v_year || '-LOT');
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Use [0-9] instead of \d to avoid backslash escaping issues
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(lot_number FROM '[0-9]+$') AS integer
    )
  ), 0) + 1 + p_offset
  INTO v_sequence
  FROM public.inventory_purchase_lots
  WHERE lot_number LIKE v_prefix || '-' || v_year || '-%';

  v_lot_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::text, 3, '0');

  RETURN v_lot_number;
END;
$$;

-- ============================================================================
-- create_lots_from_approved_transaction() — batch sequence approach
--
-- Instead of calling generate_lot_number() per item (which gets stale MAX due
-- to snapshot isolation in AFTER triggers), we:
-- 1. Acquire the advisory lock once
-- 2. Query MAX once
-- 3. Compute lot numbers as base + index (simple arithmetic)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_lots_from_approved_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_transaction_item record;
  v_lot_id uuid;
  v_lot_number text;
  v_item_index int := 0;
  v_base_sequence int;
  v_year text;
  v_prefix text;
  v_lock_key bigint;
BEGIN
  IF NEW.transaction_type = 'in' AND NEW.status = 'approved'
     AND (OLD.status IS NULL OR OLD.status != 'approved') AND NEW.manager_approved = true THEN

    v_year := to_char(now(), 'YYYY');
    v_prefix := 'LOT';
    v_lock_key := hashtext(v_prefix || '-' || v_year || '-LOT');

    -- Acquire advisory lock once (prevents concurrent lot creation)
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Query MAX ONCE — within AFTER trigger, this snapshot won't see rows we
    -- insert below, but that's fine since we use base + index arithmetic
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(lot_number FROM '[0-9]+$') AS integer)
    ), 0)
    INTO v_base_sequence
    FROM public.inventory_purchase_lots
    WHERE lot_number LIKE v_prefix || '-' || v_year || '-%';

    FOR v_transaction_item IN
      SELECT ti.id, ti.item_id, ti.quantity, ti.unit_cost, ti.purchase_unit_id,
             ti.purchase_quantity, ti.purchase_unit_multiplier, ti.notes
      FROM public.inventory_transaction_items ti
      WHERE ti.transaction_id = NEW.id ORDER BY ti.id
    LOOP
      v_item_index := v_item_index + 1;
      v_lot_number := v_prefix || '-' || v_year || '-'
                      || LPAD((v_base_sequence + v_item_index)::text, 3, '0');

      INSERT INTO public.inventory_purchase_lots (
        lot_number, store_id, item_id, supplier_id, quantity_received, quantity_remaining,
        unit_cost, purchase_date, invoice_reference, notes, status, created_by_id
      ) VALUES (
        v_lot_number, NEW.store_id, v_transaction_item.item_id, NEW.supplier_id,
        v_transaction_item.quantity, v_transaction_item.quantity, v_transaction_item.unit_cost,
        NEW.created_at, NEW.invoice_reference,
        CASE WHEN v_transaction_item.purchase_quantity IS NOT NULL THEN
          'Purchased: ' || v_transaction_item.purchase_quantity || ' units at multiplier '
          || v_transaction_item.purchase_unit_multiplier || '. ' || COALESCE(v_transaction_item.notes, '')
        ELSE v_transaction_item.notes END,
        'active', NEW.requested_by_id
      ) RETURNING id INTO v_lot_id;

      UPDATE public.inventory_transaction_items SET lot_id = v_lot_id WHERE id = v_transaction_item.id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
