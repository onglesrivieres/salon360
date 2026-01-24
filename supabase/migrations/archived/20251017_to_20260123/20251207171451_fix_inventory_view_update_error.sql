/*
  # Fix Inventory View Update Error - Remove Legacy Triggers

  ## Problem
  - Function `update_inventory_quantities()` tries to UPDATE the `inventory_items` view
  - `inventory_items` is now a VIEW (not a table), cannot be updated directly
  - Trigger `trigger_update_inventory_quantities` calls this broken function
  - Causes error: "cannot update view 'inventory_items'" when approving transactions
  
  ## Root Cause Analysis
  - Multiple triggers updating inventory on the same table event
  - Legacy function still trying to update old view instead of new `store_inventory_stock` table
  - Conflicting triggers may cause duplicate inventory updates

  ## Solution
  1. Drop broken trigger `trigger_update_inventory_quantities`
  2. Drop broken function `update_inventory_quantities()`
  3. Verify correct triggers remain active:
     - `trigger_update_inventory_on_approval` (updates store_inventory_stock)
     - `trigger_create_lots_from_approved_transaction` (creates purchase lots)
     - `trg_auto_approve_inventory` (auto-approval logic)
  4. Fix potential double-update issue in lot creation trigger

  ## Changes Made
  - Remove: trigger_update_inventory_quantities
  - Remove: update_inventory_quantities() function
  - Fix: Remove duplicate inventory update from lot creation trigger
  - Verify: Correct triggers remain functional

  ## Data Safety
  - Uses IF EXISTS to prevent errors if already cleaned up
  - Does not affect any existing data or transactions
  - Only removes obsolete database objects
  - Preserves all functional triggers
*/

-- Step 1: Drop the broken trigger
DROP TRIGGER IF EXISTS trigger_update_inventory_quantities ON public.inventory_transactions;

-- Step 2: Drop the broken function
DROP FUNCTION IF EXISTS public.update_inventory_quantities();

-- Step 3: Drop any other legacy triggers/functions that might update the view
DROP TRIGGER IF EXISTS trg_update_inventory_on_approval ON public.inventory_transactions;
DROP FUNCTION IF EXISTS public.update_inventory_quantities_on_approval();

-- Step 4: Recreate the lot creation trigger WITHOUT duplicate inventory update
-- The inventory update should only happen in trigger_update_inventory_on_approval
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
        ti.master_item_id,
        ti.quantity,
        ti.unit_cost,
        ti.purchase_unit_id,
        ti.purchase_quantity,
        ti.purchase_unit_multiplier,
        ti.notes,
        sis.store_id
      FROM public.inventory_transaction_items ti
      JOIN public.store_inventory_stock sis ON sis.id = ti.item_id
      WHERE ti.transaction_id = NEW.id
    LOOP
      -- Generate lot number
      v_lot_number := public.generate_lot_number(
        v_transaction_item.store_id,
        NULL  -- No supplier code for now
      );

      -- Create purchase lot
      INSERT INTO public.inventory_purchase_lots (
        lot_number,
        store_id,
        master_item_id,
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
        v_transaction_item.master_item_id,
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

      -- NOTE: We do NOT update store_inventory_stock here
      -- That's handled by trigger_update_inventory_on_approval to avoid duplication
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 5: Verify the correct triggers are in place
DO $$
DECLARE
  v_trigger_count integer;
BEGIN
  -- Check for the correct inventory update trigger
  SELECT COUNT(*)
  INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name = 'trigger_update_inventory_on_approval'
    AND event_object_table = 'inventory_transactions';

  IF v_trigger_count > 0 THEN
    RAISE NOTICE 'Verified: trigger_update_inventory_on_approval is active';
  ELSE
    RAISE WARNING 'Missing: trigger_update_inventory_on_approval not found!';
  END IF;

  -- Check for lot creation trigger
  SELECT COUNT(*)
  INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name = 'trigger_create_lots_from_approved_transaction'
    AND event_object_table = 'inventory_transactions';

  IF v_trigger_count > 0 THEN
    RAISE NOTICE 'Verified: trigger_create_lots_from_approved_transaction is active (updated to not duplicate inventory updates)';
  ELSE
    RAISE WARNING 'Missing: trigger_create_lots_from_approved_transaction not found!';
  END IF;

  -- Check for auto-approve trigger
  SELECT COUNT(*)
  INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name = 'trg_auto_approve_inventory'
    AND event_object_table = 'inventory_transactions';

  IF v_trigger_count > 0 THEN
    RAISE NOTICE 'Verified: trg_auto_approve_inventory is active';
  ELSE
    RAISE WARNING 'Missing: trg_auto_approve_inventory not found!';
  END IF;

  -- Check that broken triggers are removed
  SELECT COUNT(*)
  INTO v_trigger_count
  FROM information_schema.triggers
  WHERE trigger_name IN ('trigger_update_inventory_quantities', 'trg_update_inventory_on_approval')
    AND event_object_table = 'inventory_transactions';

  IF v_trigger_count = 0 THEN
    RAISE NOTICE 'Confirmed: All broken triggers have been removed';
  ELSE
    RAISE WARNING 'Warning: Some broken triggers may still exist!';
  END IF;

  RAISE NOTICE 'Inventory trigger cleanup completed successfully';
END $$;

-- Step 6: Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
