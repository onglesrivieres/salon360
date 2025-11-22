/*
  # Align Inventory Schema with Application Code
  
  ## Problem
  - Database has old inventory_items schema with: sku, current_stock, min_stock_level, unit_price
  - Application code expects: code, quantity_on_hand, reorder_level, unit_cost, unit, category
  - Schema mismatch causes "Could not find the 'code' column" error
  
  ## Solution
  - Rename columns to match application expectations
  - Add missing columns (unit, category with NOT NULL constraint)
  - Preserve existing data during migration
  - Update constraints to match new schema
  
  ## Changes
  - Rename: sku → code
  - Rename: current_stock → quantity_on_hand (change type to numeric(10,2))
  - Rename: min_stock_level → reorder_level (change type to numeric(10,2))
  - Rename: unit_price → unit_cost (change type to numeric(10,2))
  - Add: unit text NOT NULL DEFAULT 'piece'
  - Update: category to NOT NULL (was nullable)
  - Update: UNIQUE constraint to use (store_id, code) instead of (store_id, sku)
*/

-- Step 1: Add new columns with defaults (before renaming to avoid conflicts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'inventory_items' AND column_name = 'unit'
  ) THEN
    ALTER TABLE public.inventory_items 
    ADD COLUMN unit text NOT NULL DEFAULT 'piece';
  END IF;
END $$;

-- Step 2: Make category NOT NULL (set default for existing nulls)
UPDATE public.inventory_items 
SET category = 'General' 
WHERE category IS NULL OR category = '';

ALTER TABLE public.inventory_items 
ALTER COLUMN category SET NOT NULL;

-- Step 3: Drop old unique constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'inventory_items_store_id_sku_key'
  ) THEN
    ALTER TABLE public.inventory_items 
    DROP CONSTRAINT inventory_items_store_id_sku_key;
  END IF;
END $$;

-- Step 4: Rename columns
ALTER TABLE public.inventory_items 
RENAME COLUMN sku TO code;

ALTER TABLE public.inventory_items 
RENAME COLUMN current_stock TO quantity_on_hand;

ALTER TABLE public.inventory_items 
RENAME COLUMN min_stock_level TO reorder_level;

ALTER TABLE public.inventory_items 
RENAME COLUMN unit_price TO unit_cost;

-- Step 5: Change column types to numeric(10,2)
ALTER TABLE public.inventory_items 
ALTER COLUMN quantity_on_hand TYPE numeric(10,2);

ALTER TABLE public.inventory_items 
ALTER COLUMN reorder_level TYPE numeric(10,2);

ALTER TABLE public.inventory_items 
ALTER COLUMN unit_cost TYPE numeric(10,2);

-- Step 6: Add new unique constraint with renamed column
ALTER TABLE public.inventory_items 
ADD CONSTRAINT inventory_items_store_id_code_key UNIQUE (store_id, code);

-- Step 7: Update defaults to match expected schema
ALTER TABLE public.inventory_items 
ALTER COLUMN quantity_on_hand SET DEFAULT 0;

ALTER TABLE public.inventory_items 
ALTER COLUMN reorder_level SET DEFAULT 0;

ALTER TABLE public.inventory_items 
ALTER COLUMN unit_cost SET DEFAULT 0;

-- Step 8: Ensure NOT NULL constraints match expected schema
ALTER TABLE public.inventory_items 
ALTER COLUMN code SET NOT NULL;

ALTER TABLE public.inventory_items 
ALTER COLUMN quantity_on_hand SET NOT NULL;

ALTER TABLE public.inventory_items 
ALTER COLUMN reorder_level SET NOT NULL;

ALTER TABLE public.inventory_items 
ALTER COLUMN unit_cost SET NOT NULL;

ALTER TABLE public.inventory_items 
ALTER COLUMN unit SET NOT NULL;

-- Step 9: Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Add comment documenting the aligned schema
COMMENT ON TABLE public.inventory_items IS 
  'Store inventory items with stock levels. Schema aligned with application code.
   Columns: code (item code), quantity_on_hand (current stock), reorder_level (minimum stock),
   unit_cost (cost per unit), unit (unit of measure), category (item category).';
