/*
  # Fix Inventory Transaction Items Foreign Key Constraint

  ## Summary
  Fixes the invalid foreign key constraint on inventory_transaction_items.item_id
  that incorrectly references the VIEW 'inventory_items' instead of the actual table
  'store_inventory_stock'.

  ## Problem
  - inventory_transaction_items.item_id has FK constraint to inventory_items(id)
  - inventory_items is a VIEW, not a table
  - PostgreSQL cannot enforce FK constraints on views
  - This causes "cannot update view 'inventory_items'" error when approving transactions

  ## Solution
  1. Drop the invalid foreign key constraint
  2. Create new constraint referencing store_inventory_stock(id) table
  3. Verify data integrity before applying constraint

  ## Changes Made
  - Drop constraint: inventory_transaction_items_item_id_fkey
  - Add constraint: inventory_transaction_items_item_id_fkey_stock
  - References: store_inventory_stock(id) instead of inventory_items(id)

  ## Data Safety
  - Uses IF EXISTS to prevent errors if constraint doesn't exist
  - Validates existing data references before adding new constraint
*/

-- Step 1: Drop the invalid foreign key constraint that references the view
DO $$
BEGIN
  -- Drop constraint if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'inventory_transaction_items_item_id_fkey'
    AND table_name = 'inventory_transaction_items'
  ) THEN
    ALTER TABLE public.inventory_transaction_items
    DROP CONSTRAINT inventory_transaction_items_item_id_fkey;

    RAISE NOTICE 'Dropped invalid FK constraint inventory_transaction_items_item_id_fkey';
  END IF;
END $$;

-- Step 2: Verify data integrity - check if all item_ids exist in store_inventory_stock
DO $$
DECLARE
  v_invalid_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_invalid_count
  FROM public.inventory_transaction_items iti
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.store_inventory_stock sis
    WHERE sis.id = iti.item_id
  );

  IF v_invalid_count > 0 THEN
    RAISE WARNING 'Found % inventory_transaction_items records with invalid item_id references', v_invalid_count;
  ELSE
    RAISE NOTICE 'All inventory_transaction_items.item_id references are valid';
  END IF;
END $$;

-- Step 3: Add the correct foreign key constraint to store_inventory_stock table
DO $$
BEGIN
  -- Add constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'inventory_transaction_items_item_id_fkey_stock'
    AND table_name = 'inventory_transaction_items'
  ) THEN
    ALTER TABLE public.inventory_transaction_items
    ADD CONSTRAINT inventory_transaction_items_item_id_fkey_stock
    FOREIGN KEY (item_id)
    REFERENCES public.store_inventory_stock(id)
    ON DELETE RESTRICT;

    RAISE NOTICE 'Added correct FK constraint inventory_transaction_items_item_id_fkey_stock';
  END IF;
END $$;

-- Step 4: Add index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_item_id
  ON public.inventory_transaction_items(item_id);

-- Step 5: Add helpful comment
COMMENT ON CONSTRAINT inventory_transaction_items_item_id_fkey_stock
  ON public.inventory_transaction_items IS
  'Foreign key to store_inventory_stock table (not the inventory_items view)';

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
