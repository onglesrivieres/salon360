/*
  # Fix Lot Creation with Retry Loop

  ## Problem
  The previous fix (20260123154656) added pg_advisory_xact_lock to generate_lot_number(),
  but the error still persists:
  "duplicate key value violates unique constraint inventory_purchase_lots_lot_number_key"

  ## Root Cause
  When a transaction has multiple items, generate_lot_number() is called multiple times
  in the same transaction. pg_advisory_xact_lock is re-entrant within the same transaction,
  so subsequent calls pass through immediately. Edge cases with snapshot isolation can
  cause the same lot number to be generated twice.

  ## Solution
  Add a retry loop with exception handling in the trigger function. If an INSERT fails
  with a unique constraint violation, regenerate the lot number and retry.
  This is the most robust approach that handles ALL race conditions.

  ## Changes
  - Update create_lots_from_approved_transaction() to retry on unique_violation
  - Max 10 retries before failing
*/

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

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
  v_retry_count int;
  v_max_retries int := 10;
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

    -- Process each transaction item
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
    LOOP
      v_retry_count := 0;

      -- Retry loop to handle duplicate lot numbers
      LOOP
        BEGIN
          -- Generate lot number (uses advisory lock internally)
          v_lot_number := public.generate_lot_number(
            v_transaction_item.store_id,
            NULL
          );

          -- Try to insert the purchase lot
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

          -- Success! Exit the retry loop
          EXIT;

        EXCEPTION WHEN unique_violation THEN
          -- Duplicate lot number - increment retry counter
          v_retry_count := v_retry_count + 1;

          -- Check if we've exceeded max retries
          IF v_retry_count >= v_max_retries THEN
            RAISE EXCEPTION 'Failed to generate unique lot number after % retries for transaction %', v_max_retries, NEW.id;
          END IF;

          -- Log retry attempt (optional, can be removed in production)
          RAISE NOTICE 'Lot number collision detected, retry attempt % of %', v_retry_count, v_max_retries;

          -- Continue to next iteration of retry loop
        END;
      END LOOP;

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

COMMENT ON FUNCTION public.create_lots_from_approved_transaction IS
  'Creates purchase lots when inventory IN transactions are approved.
   Includes retry logic to handle duplicate lot number race conditions.
   Uses item_id (NOT master_item_id). Fixed in 20260123160120.';

-- ============================================================================
-- SCHEMA CACHE RELOAD
-- ============================================================================

NOTIFY pgrst, 'reload schema';
