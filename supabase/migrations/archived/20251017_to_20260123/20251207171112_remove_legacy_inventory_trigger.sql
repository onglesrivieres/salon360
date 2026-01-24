/*
  # Remove Legacy Inventory Trigger That Updates View

  ## Problem
  - Old trigger `trg_update_inventory_on_approval` tries to UPDATE the `inventory_items` view
  - `inventory_items` is now a VIEW (not a table), cannot be updated directly
  - Causes error: "cannot update view 'inventory_items'"
  - This trigger was superseded by newer triggers that correctly update `store_inventory_stock` table

  ## Solution
  1. Drop the old broken trigger `trg_update_inventory_on_approval`
  2. Drop the old broken function `update_inventory_quantities_on_approval()`
  3. Keep the new working triggers:
     - `trigger_update_inventory_on_approval` (updates store_inventory_stock)
     - `trigger_create_lots_from_approved_transaction` (creates purchase lots)
     - `trg_auto_approve_inventory` (auto-approval logic)

  ## Changes Made
  - Remove: trg_update_inventory_on_approval trigger
  - Remove: update_inventory_quantities_on_approval() function
  - Verify: New triggers remain active and functional

  ## Data Safety
  - Uses IF EXISTS to prevent errors if already cleaned up
  - Does not affect any data or existing transactions
  - Only removes obsolete database objects
*/

-- Step 1: Drop the old broken trigger
DROP TRIGGER IF EXISTS trg_update_inventory_on_approval ON public.inventory_transactions;

-- Step 2: Drop the old broken function
DROP FUNCTION IF EXISTS public.update_inventory_quantities_on_approval();

-- Step 3: Verify new triggers exist and log status
DO $$
DECLARE
  v_trigger_count integer;
BEGIN
  -- Check for the new correct trigger
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
    RAISE NOTICE 'Verified: trigger_create_lots_from_approved_transaction is active';
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

  RAISE NOTICE 'Legacy trigger cleanup completed successfully';
END $$;

-- Step 4: Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
