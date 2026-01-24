/*
  # Add item_id Column to inventory_purchase_lots

  ## Problem
  The `inventory_purchase_lots` table was created with `master_item_id` FK
  to `master_inventory_items`, but that table was later dropped with CASCADE.
  The TypeScript interface expects `item_id` to reference `inventory_items`.

  ## Fix
  1. Add `item_id` column with FK to `inventory_items`
  2. Create index for performance
  3. Update trigger function to use `item_id`
*/

-- Step 1: Add item_id column to inventory_purchase_lots
ALTER TABLE public.inventory_purchase_lots
ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.inventory_items(id) ON DELETE RESTRICT;

-- Step 2: Create index for item_id lookups
CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_item_id
ON public.inventory_purchase_lots(item_id);

-- Step 3: Create composite index for store + item + status queries
CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_store_item_id_status
ON public.inventory_purchase_lots(store_id, item_id, status);

-- Step 4: Update the trigger function to use item_id
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
      -- Generate lot number
      v_lot_number := public.generate_lot_number(
        v_transaction_item.store_id,
        NULL  -- No supplier code for now
      );

      -- Create purchase lot using item_id column
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
            'Purchased: ' || v_transaction_item.purchase_quantity || ' units at multiplier ' || v_transaction_item.purchase_unit_multiplier || '. ' || v_transaction_item.notes
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

      -- NOTE: Inventory quantity updates are handled by trg_update_inventory_on_approval
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 5: Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_create_lots_from_approved_transaction ON public.inventory_transactions;
CREATE TRIGGER trigger_create_lots_from_approved_transaction
  AFTER UPDATE ON public.inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_lots_from_approved_transaction();

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
