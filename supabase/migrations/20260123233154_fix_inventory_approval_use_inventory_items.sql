/*
  # Fix Inventory Approval - Use inventory_items Table

  ## Problem
  The `update_inventory_on_transaction_approval()` function calls
  `adjust_store_stock()` which references `store_inventory_stock` table.

  But `store_inventory_stock` was DROPPED in migration 20251207172905.
  Schema was restructured: quantity_on_hand is now directly in `inventory_items`.

  Error: "relation 'public.store_inventory_stock' does not exist"

  ## Fix
  Update inventory_items.quantity_on_hand directly instead of calling
  the broken adjust_store_stock() function.
*/

CREATE OR REPLACE FUNCTION public.update_inventory_on_transaction_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN

    -- Loop through all items in the transaction
    FOR v_item IN
      SELECT item_id, quantity
      FROM public.inventory_transaction_items
      WHERE transaction_id = NEW.id
    LOOP
      -- Update inventory_items directly (store_inventory_stock was dropped)
      IF NEW.transaction_type = 'in' THEN
        UPDATE public.inventory_items
        SET quantity_on_hand = quantity_on_hand + v_item.quantity,
            updated_at = now()
        WHERE id = v_item.item_id;
      ELSE
        UPDATE public.inventory_items
        SET quantity_on_hand = quantity_on_hand - v_item.quantity,
            updated_at = now()
        WHERE id = v_item.item_id;
      END IF;
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
