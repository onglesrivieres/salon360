/*
  # Clear All Inventory Data for Ongles Rivières Store

  ## Purpose
  Remove all inventory-related data for the Ongles Rivières store.
  This is a data cleanup operation requested by admin.

  ## Impact
  - Deletes all inventory stock quantities
  - Deletes all purchase lots
  - Deletes all inventory transactions (IN/OUT)
  - Deletes all distributions and employee inventory
  - Deletes all audit records
  - Deletes purchase unit configs and preferences

  ## Preserved
  - Store record itself
  - Employees
  - Tickets/services
  - All other store data
*/

DO $$
DECLARE
  v_store_id uuid := '090391d3-0899-4947-8735-c0bfe8dbe0e4';
  v_store_name text;
BEGIN
  -- Verify store exists
  SELECT name INTO v_store_name FROM stores WHERE id = v_store_id;

  IF v_store_name IS NULL THEN
    RAISE EXCEPTION 'Store not found with ID: %', v_store_id;
  END IF;

  RAISE NOTICE 'Clearing inventory data for store: %', v_store_name;

  -- 1. Delete audit items (via audit cascade)
  DELETE FROM inventory_audit_items
  WHERE audit_id IN (SELECT id FROM inventory_audits WHERE store_id = v_store_id);
  RAISE NOTICE 'Deleted inventory_audit_items';

  -- 2. Delete audits
  DELETE FROM inventory_audits WHERE store_id = v_store_id;
  RAISE NOTICE 'Deleted inventory_audits';

  -- 3. Delete distributions
  DELETE FROM inventory_distributions WHERE store_id = v_store_id;
  RAISE NOTICE 'Deleted inventory_distributions';

  -- 4. Delete employee inventory lots
  DELETE FROM employee_inventory_lots WHERE store_id = v_store_id;
  RAISE NOTICE 'Deleted employee_inventory_lots';

  -- 5. Delete employee inventory summaries
  DELETE FROM employee_inventory WHERE store_id = v_store_id;
  RAISE NOTICE 'Deleted employee_inventory';

  -- 6. Delete transaction items (via transaction cascade)
  DELETE FROM inventory_transaction_items
  WHERE transaction_id IN (SELECT id FROM inventory_transactions WHERE store_id = v_store_id);
  RAISE NOTICE 'Deleted inventory_transaction_items';

  -- 7. Delete transactions
  DELETE FROM inventory_transactions WHERE store_id = v_store_id;
  RAISE NOTICE 'Deleted inventory_transactions';

  -- 8. Delete purchase lots
  DELETE FROM inventory_purchase_lots WHERE store_id = v_store_id;
  RAISE NOTICE 'Deleted inventory_purchase_lots';

  -- 9. Delete product preferences
  DELETE FROM store_product_preferences WHERE store_id = v_store_id;
  RAISE NOTICE 'Deleted store_product_preferences';

  -- 10. Delete purchase units
  DELETE FROM store_product_purchase_units WHERE store_id = v_store_id;
  RAISE NOTICE 'Deleted store_product_purchase_units';

  -- 11. Delete stock quantities (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_inventory_stock') THEN
    EXECUTE format('DELETE FROM store_inventory_stock WHERE store_id = %L', v_store_id);
    RAISE NOTICE 'Deleted store_inventory_stock';
  ELSE
    RAISE NOTICE 'Table store_inventory_stock does not exist, skipping';
  END IF;

  RAISE NOTICE 'Successfully cleared all inventory data for %', v_store_name;
END $$;
