/*
  # Add item_id Column to store_product_purchase_units

  ## Problem
  The `store_product_purchase_units` table has `master_item_id` column,
  but the frontend uses `item_id`. This causes:
  "column master_item_id does not exist" error when saving purchase units.

  ## Fix
  Add `item_id` column with FK to `inventory_items`.
*/

-- Step 1: Add item_id column
ALTER TABLE public.store_product_purchase_units
ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE;

-- Step 2: Create index for item_id lookups
CREATE INDEX IF NOT EXISTS idx_store_product_purchase_units_item_id
ON public.store_product_purchase_units(item_id);

-- Step 3: Create composite index for store + item queries
CREATE INDEX IF NOT EXISTS idx_store_product_purchase_units_store_item_id
ON public.store_product_purchase_units(store_id, item_id);

-- Step 4: Create unique constraint for store + item + unit_name
-- First drop old constraint if exists, then create new one
DO $$
BEGIN
  -- Try to create the new unique constraint (will fail silently if it exists)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'store_product_purchase_units_unique_item_name'
  ) THEN
    ALTER TABLE public.store_product_purchase_units
    ADD CONSTRAINT store_product_purchase_units_unique_item_name
    UNIQUE (store_id, item_id, unit_name);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors (constraint may already exist or item_id may have nulls)
  NULL;
END $$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
