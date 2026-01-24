/*
  # Definitive Fix: Lot Creation Trigger - Use item_id

  ## Problem
  Error when approving inventory transactions:
  "column 'master_item_id' does not exist"

  This error occurs because the `create_lots_from_approved_transaction()` function
  references `master_item_id` which no longer exists after schema migration.

  ## Root Cause
  Multiple conflicting migrations define this function with different column references.
  The database may have an older broken version loaded.

  ## Fix
  Definitively DROP and recreate everything:
  1. DROP trigger
  2. DROP function CASCADE
  3. Ensure item_id column exists in inventory_purchase_lots
  4. Recreate function using item_id
  5. Recreate trigger
  6. Force schema cache reload
*/

-- =====================================================
-- Step 1: Drop existing trigger
-- =====================================================
DROP TRIGGER IF EXISTS trigger_create_lots_from_approved_transaction ON public.inventory_transactions;

-- =====================================================
-- Step 2: Drop function with CASCADE to remove all dependencies
-- =====================================================
DROP FUNCTION IF EXISTS public.create_lots_from_approved_transaction() CASCADE;

-- =====================================================
-- Step 3: Ensure item_id column exists in inventory_purchase_lots
-- =====================================================
ALTER TABLE public.inventory_purchase_lots
ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.inventory_items(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_item_id
ON public.inventory_purchase_lots(item_id);

-- =====================================================
-- Step 4: Recreate create_lots_from_approved_transaction using item_id
-- =====================================================
CREATE FUNCTION public.create_lots_from_approved_transaction()
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
    -- NOTE: Uses ti.item_id (NOT master_item_id which doesn't exist)
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
      -- Generate lot number
      v_lot_number := public.generate_lot_number(
        v_transaction_item.store_id,
        NULL
      );

      -- Create purchase lot
      -- NOTE: Uses item_id column (NOT master_item_id)
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

      -- Update transaction item with lot_id
      UPDATE public.inventory_transaction_items
      SET lot_id = v_lot_id
      WHERE id = v_transaction_item.id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- Step 5: Recreate the trigger
-- =====================================================
CREATE TRIGGER trigger_create_lots_from_approved_transaction
  AFTER UPDATE ON public.inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_lots_from_approved_transaction();

-- =====================================================
-- Step 6: Add comment
-- =====================================================
COMMENT ON FUNCTION public.create_lots_from_approved_transaction IS
  'Creates purchase lots when inventory IN transactions are approved. Uses item_id (NOT master_item_id).';

-- =====================================================
-- Step 7: Force PostgREST to reload schema cache
-- =====================================================
NOTIFY pgrst, 'reload schema';
