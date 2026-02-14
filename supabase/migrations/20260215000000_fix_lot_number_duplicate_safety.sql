-- Fix duplicate lot number on inventory transaction approval
--
-- Root cause: generate_lot_number() uses '\d+$' regex which may not work
-- depending on PostgreSQL's standard_conforming_strings setting, causing
-- SUBSTRING to return NULL and the function to always generate sequence 1.
--
-- Fix 1: Replace '\d+$' with POSIX '[0-9]+$' in generate_lot_number()
-- Fix 2: Add retry loop in create_lots_from_approved_transaction() as
--         defense-in-depth against unique_violation on lot_number

-- ============================================================================
-- FIX 1: generate_lot_number() — use POSIX [0-9] instead of \d
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
-- FIX 2: create_lots_from_approved_transaction() — retry on unique_violation
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
  v_retry_count int;
  v_max_retries int := 5;
BEGIN
  IF NEW.transaction_type = 'in' AND NEW.status = 'approved'
     AND (OLD.status IS NULL OR OLD.status != 'approved') AND NEW.manager_approved = true THEN
    FOR v_transaction_item IN
      SELECT ti.id, ti.item_id, ti.quantity, ti.unit_cost, ti.purchase_unit_id,
             ti.purchase_quantity, ti.purchase_unit_multiplier, ti.notes
      FROM public.inventory_transaction_items ti
      WHERE ti.transaction_id = NEW.id ORDER BY ti.id
    LOOP
      v_retry_count := 0;

      LOOP
        BEGIN
          v_lot_number := public.generate_lot_number(NEW.store_id, NULL, v_item_index + v_retry_count);

          INSERT INTO public.inventory_purchase_lots (
            lot_number, store_id, item_id, supplier_id, quantity_received, quantity_remaining,
            unit_cost, purchase_date, invoice_reference, notes, status, created_by_id
          ) VALUES (
            v_lot_number, NEW.store_id, v_transaction_item.item_id, NEW.supplier_id,
            v_transaction_item.quantity, v_transaction_item.quantity, v_transaction_item.unit_cost,
            NEW.created_at, NEW.invoice_reference,
            CASE WHEN v_transaction_item.purchase_quantity IS NOT NULL THEN
              'Purchased: ' || v_transaction_item.purchase_quantity || ' units at multiplier ' || v_transaction_item.purchase_unit_multiplier || '. ' || COALESCE(v_transaction_item.notes, '')
            ELSE v_transaction_item.notes END,
            'active', NEW.requested_by_id
          ) RETURNING id INTO v_lot_id;

          -- Success — exit retry loop
          EXIT;

        EXCEPTION WHEN unique_violation THEN
          v_retry_count := v_retry_count + 1;
          IF v_retry_count >= v_max_retries THEN
            RAISE EXCEPTION 'Failed to generate unique lot number after % retries for transaction %', v_max_retries, NEW.id;
          END IF;
          -- Loop again with incremented offset
        END;
      END LOOP;

      UPDATE public.inventory_transaction_items SET lot_id = v_lot_id WHERE id = v_transaction_item.id;
      v_item_index := v_item_index + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
