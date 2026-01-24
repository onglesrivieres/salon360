/*
  # Clear Inventory Items for Ongles Rivières Store

  ## Purpose
  Remove all inventory items from the Items tab for the Ongles Rivières store.
  This complements the previous migration that cleared transactions, lots, and distributions.

  ## Impact
  - Deletes all items from inventory_items table for this store
  - Items tab will be empty after this migration

  ## Preserved
  - master_inventory_items (shared catalog across stores)
  - Store record itself
  - All non-inventory data
*/

DO $$
DECLARE
  v_store_id uuid := '090391d3-0899-4947-8735-c0bfe8dbe0e4';
  v_count integer;
BEGIN
  -- Delete from inventory_items if it exists as a table (not a view)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'inventory_items'
      AND table_type = 'BASE TABLE'
  ) THEN
    EXECUTE format('DELETE FROM inventory_items WHERE store_id = %L', v_store_id);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % rows from inventory_items', v_count;
  ELSE
    RAISE NOTICE 'inventory_items is not a table (may be a view), skipping direct delete';

    -- If it's a view, the underlying table is store_inventory_stock
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'store_inventory_stock'
        AND table_type = 'BASE TABLE'
    ) THEN
      EXECUTE format('DELETE FROM store_inventory_stock WHERE store_id = %L', v_store_id);
      GET DIAGNOSTICS v_count = ROW_COUNT;
      RAISE NOTICE 'Deleted % rows from store_inventory_stock', v_count;
    ELSE
      RAISE NOTICE 'store_inventory_stock does not exist either';
    END IF;
  END IF;

  RAISE NOTICE 'Completed clearing items for Ongles Rivieres';
END $$;
