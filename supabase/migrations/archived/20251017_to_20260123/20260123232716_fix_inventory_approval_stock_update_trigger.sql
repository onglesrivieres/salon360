/*
  # Fix Inventory Stock Update Trigger - master_item_id Reference

  ## Problem
  The `update_inventory_on_transaction_approval()` function references
  `master_item_id` which doesn't exist in `inventory_transaction_items` table.

  Error: "column master_item_id does not exist"

  ## Root Cause
  The function at line 208 of 20251122213606_add_inventory_helper_functions.sql:
  ```sql
  SELECT master_item_id as item_id, quantity, unit_cost
  FROM public.inventory_transaction_items
  ```

  But `inventory_transaction_items` table has `item_id` column, not `master_item_id`.

  ## Fix
  Change SELECT to use `item_id` (the actual column name).
*/

-- Recreate function with correct column reference
CREATE OR REPLACE FUNCTION public.update_inventory_on_transaction_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_quantity_change numeric;
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN

    -- Loop through all items in the transaction
    -- FIX: Changed from master_item_id to item_id (the actual column)
    FOR v_item IN
      SELECT item_id, quantity, unit_cost
      FROM public.inventory_transaction_items
      WHERE transaction_id = NEW.id
    LOOP
      -- Calculate quantity change based on transaction type
      IF NEW.transaction_type = 'in' THEN
        v_quantity_change := v_item.quantity;  -- Add to stock
      ELSE
        v_quantity_change := -v_item.quantity; -- Subtract from stock
      END IF;

      -- Adjust stock using helper function
      PERFORM public.adjust_store_stock(
        NEW.store_id,
        v_item.item_id,
        v_quantity_change,
        false  -- Don't allow negative stock
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
