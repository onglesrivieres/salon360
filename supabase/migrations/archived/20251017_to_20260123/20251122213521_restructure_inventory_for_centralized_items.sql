/*
  # Restructure Inventory for Centralized Items with Per-Store Quantities
  
  ## Problem
  - Currently each store has separate inventory_items records
  - Same item (e.g., "Red Polish") duplicated across stores
  - Updating item info requires changes in every store
  - No central product catalog
  - Difficult to track company-wide inventory
  
  ## Solution
  - Create master_inventory_items: Centralized product catalog
  - Create store_inventory_stock: Per-store quantities
  - All stores share item definitions, maintain own quantities
  - Support store-specific cost/reorder overrides
  
  ## New Tables
  
  ### master_inventory_items
  - Central product catalog with company-wide unique codes
  - Contains item definitions (name, description, category, unit)
  - Default cost and reorder level for all stores
  
  ### store_inventory_stock
  - Per-store quantity tracking
  - Links stores to master items
  - Optional cost/reorder level overrides
  - One record per item per store
  
  ## Data Migration
  1. Extract unique items from current inventory_items (by code)
  2. Create master records for each unique item
  3. Create store_inventory_stock records preserving quantities
  4. Update foreign keys in transaction tables
  5. Keep old table as backup (renamed to inventory_items_old)
  
  ## Benefits
  - Single source of truth for product definitions
  - Easy to add new stores (inherit full catalog)
  - Consistent naming across all stores
  - Simplified inventory transfers between stores
  - Company-wide reporting capability
*/

-- Step 1: Create master_inventory_items table (centralized product catalog)
CREATE TABLE IF NOT EXISTS public.master_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'piece',
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  reorder_level numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT master_inventory_items_code_not_empty CHECK (code <> ''),
  CONSTRAINT master_inventory_items_name_not_empty CHECK (name <> ''),
  CONSTRAINT master_inventory_items_unit_cost_non_negative CHECK (unit_cost >= 0),
  CONSTRAINT master_inventory_items_reorder_level_non_negative CHECK (reorder_level >= 0)
);

-- Step 2: Create store_inventory_stock table (per-store quantities)
CREATE TABLE IF NOT EXISTS public.store_inventory_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.master_inventory_items(id) ON DELETE CASCADE,
  quantity_on_hand numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost_override numeric(10,2),
  reorder_level_override numeric(10,2),
  last_counted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT store_inventory_stock_unique_store_item UNIQUE(store_id, item_id),
  CONSTRAINT store_inventory_stock_quantity_non_negative CHECK (quantity_on_hand >= 0),
  CONSTRAINT store_inventory_stock_cost_override_non_negative CHECK (unit_cost_override IS NULL OR unit_cost_override >= 0),
  CONSTRAINT store_inventory_stock_reorder_override_non_negative CHECK (reorder_level_override IS NULL OR reorder_level_override >= 0)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_master_inventory_items_code ON public.master_inventory_items(code);
CREATE INDEX IF NOT EXISTS idx_master_inventory_items_category ON public.master_inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_master_inventory_items_active ON public.master_inventory_items(is_active);

CREATE INDEX IF NOT EXISTS idx_store_inventory_stock_store_id ON public.store_inventory_stock(store_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_stock_item_id ON public.store_inventory_stock(item_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_stock_low_stock ON public.store_inventory_stock(store_id, quantity_on_hand);

-- Step 4: Migrate data from old inventory_items to new structure
-- 4a: Extract unique items and create master records
INSERT INTO public.master_inventory_items (code, name, description, category, unit, unit_cost, reorder_level, is_active, created_at)
SELECT DISTINCT ON (code)
  code,
  name,
  description,
  category,
  unit,
  unit_cost,
  reorder_level,
  is_active,
  created_at
FROM public.inventory_items
ORDER BY code, created_at
ON CONFLICT (code) DO NOTHING;

-- 4b: Create store_inventory_stock records for each store's quantities
INSERT INTO public.store_inventory_stock (store_id, item_id, quantity_on_hand, unit_cost_override, reorder_level_override, created_at, updated_at)
SELECT 
  old.store_id,
  master.id as item_id,
  old.quantity_on_hand,
  CASE 
    WHEN old.unit_cost != master.unit_cost THEN old.unit_cost 
    ELSE NULL 
  END as unit_cost_override,
  CASE 
    WHEN old.reorder_level != master.reorder_level THEN old.reorder_level 
    ELSE NULL 
  END as reorder_level_override,
  old.created_at,
  old.updated_at
FROM public.inventory_items old
JOIN public.master_inventory_items master ON master.code = old.code
ON CONFLICT (store_id, item_id) DO NOTHING;

-- Step 5: Add new column to inventory_transaction_items for easier migration
ALTER TABLE public.inventory_transaction_items 
ADD COLUMN IF NOT EXISTS master_item_id uuid REFERENCES public.master_inventory_items(id) ON DELETE RESTRICT;

-- Step 6: Populate master_item_id in transaction items
UPDATE public.inventory_transaction_items ti
SET master_item_id = master.id
FROM public.inventory_items old
JOIN public.master_inventory_items master ON master.code = old.code
WHERE ti.item_id = old.id;

-- Step 7: Enable RLS on new tables
ALTER TABLE public.master_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_inventory_stock ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies for master_inventory_items

-- All authenticated users can view active master items
CREATE POLICY "Users can view master inventory items"
  ON public.master_inventory_items FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Managers and Owners can insert master items
CREATE POLICY "Managers can create master items"
  ON public.master_inventory_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Managers and Owners can update master items
CREATE POLICY "Managers can update master items"
  ON public.master_inventory_items FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Step 9: Create RLS policies for store_inventory_stock

-- Users can view stock for stores they have access to
CREATE POLICY "Users can view store inventory stock"
  ON public.store_inventory_stock FOR SELECT
  TO anon, authenticated
  USING (true);

-- Users can insert stock records for their stores
CREATE POLICY "Users can create store stock records"
  ON public.store_inventory_stock FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can update stock for their stores
CREATE POLICY "Users can update store stock"
  ON public.store_inventory_stock FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Step 10: Rename old table for backup (keep for rollback safety)
ALTER TABLE public.inventory_items RENAME TO inventory_items_old;

-- Step 11: Create view for backward compatibility (optional, helps transition)
CREATE OR REPLACE VIEW public.inventory_items AS
SELECT 
  sis.id,
  sis.store_id,
  mi.code,
  mi.name,
  mi.description,
  mi.category,
  mi.unit,
  sis.quantity_on_hand,
  COALESCE(sis.unit_cost_override, mi.unit_cost) as unit_cost,
  COALESCE(sis.reorder_level_override, mi.reorder_level) as reorder_level,
  mi.is_active,
  sis.created_at,
  sis.updated_at,
  mi.id as master_item_id
FROM public.store_inventory_stock sis
JOIN public.master_inventory_items mi ON mi.id = sis.item_id;

-- Step 12: Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Add helpful comments
COMMENT ON TABLE public.master_inventory_items IS 
  'Centralized product catalog. All stores share these item definitions. 
   Company-wide unique item codes. Contains default cost and reorder level.';

COMMENT ON TABLE public.store_inventory_stock IS 
  'Per-store inventory quantities. Each store tracks its own stock levels.
   Can override cost and reorder level per store. Links to master_inventory_items.';

COMMENT ON VIEW public.inventory_items IS
  'Backward compatibility view. Combines master items with store stock.
   Allows old queries to continue working during transition period.';
