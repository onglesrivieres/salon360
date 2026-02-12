/*
  # Clean Up DND DC Original 066 Sub-Item and Lots

  ## Overview
  Removes the only remaining DND sub-item ("Original 066") and its associated lots,
  transaction items, orphaned transactions, and store inventory levels. Converts the
  parent master item ("DND DC Original 066") to standalone.

  ## Changes

  ### Data Cleanup
  - `inventory_purchase_lots` — Delete 3 lots linked to sub-item 809be12f
  - `inventory_transaction_items` — Delete 5 rows linked to sub-item 809be12f
  - `inventory_transactions` — Delete orphaned parent transactions with no remaining items
  - `store_inventory_levels` — Delete 3 rows for sub-item 809be12f
  - `inventory_items` — Delete sub-item 809be12f

  ### Updates
  - `inventory_items` — Convert master item febbadad to standalone (is_master_item = false)

  ## Notes
  - All 361 other DND items are already standalone; this cleans up the last one
  - Wrapped in a DO block for atomicity
*/

DO $$
DECLARE
  v_sub_item_id uuid := '809be12f-b1c0-4220-b165-abe89b1df742';
  v_master_item_id uuid := 'febbadad-907a-4c47-bdaf-d1bcb4ce3a0e';
  v_orphaned_tx_ids uuid[];
BEGIN
  -- 1. Delete purchase lots for the sub-item
  DELETE FROM public.inventory_purchase_lots
  WHERE item_id = v_sub_item_id;

  -- 2. Collect transaction IDs before deleting transaction items
  --    (these may become orphaned after item deletion)
  SELECT ARRAY_AGG(DISTINCT transaction_id)
  INTO v_orphaned_tx_ids
  FROM public.inventory_transaction_items
  WHERE item_id = v_sub_item_id;

  -- 3. Delete transaction items for the sub-item
  DELETE FROM public.inventory_transaction_items
  WHERE item_id = v_sub_item_id;

  -- 4. Delete orphaned transactions (those with no remaining items)
  IF v_orphaned_tx_ids IS NOT NULL THEN
    DELETE FROM public.inventory_transactions t
    WHERE t.id = ANY(v_orphaned_tx_ids)
      AND NOT EXISTS (
        SELECT 1 FROM public.inventory_transaction_items ti
        WHERE ti.transaction_id = t.id
      );
  END IF;

  -- 5. Delete store inventory levels for the sub-item
  DELETE FROM public.store_inventory_levels
  WHERE item_id = v_sub_item_id;

  -- 6. Delete the sub-item itself
  DELETE FROM public.inventory_items
  WHERE id = v_sub_item_id;

  -- 7. Convert the master item to standalone
  UPDATE public.inventory_items
  SET is_master_item = false
  WHERE id = v_master_item_id;
END $$;

-- 8. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
