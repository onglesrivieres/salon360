/*
  # Restore Per-Store Inventory Independence

  ## Overview
  Reverses the centralized master_inventory_items system and restores
  independent inventory management for each store. Each store will manage
  its own inventory items without any shared product catalog.

  Note: This migration is wrapped in conditionals to handle cases where
  the source tables (store_inventory_stock, master_inventory_items) don't exist.
*/

-- Step 1: Drop the inventory_items view
DROP VIEW IF EXISTS public.inventory_items CASCADE;

-- Step 2: Create new inventory_items table with full item details
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'piece',
  brand text,
  supplier text DEFAULT 'Generic',
  quantity_on_hand numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  reorder_level numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT inventory_items_unique_store_name UNIQUE(store_id, name),
  CONSTRAINT inventory_items_name_not_empty CHECK (name <> ''),
  CONSTRAINT inventory_items_quantity_non_negative CHECK (quantity_on_hand >= 0),
  CONSTRAINT inventory_items_unit_cost_non_negative CHECK (unit_cost >= 0),
  CONSTRAINT inventory_items_reorder_level_non_negative CHECK (reorder_level >= 0)
);

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_store_id ON public.inventory_items(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON public.inventory_items(store_id, name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(store_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON public.inventory_items(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock ON public.inventory_items(store_id, quantity_on_hand);

-- Step 4: Enable RLS on inventory_items
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for inventory_items
DROP POLICY IF EXISTS "Users can view inventory items" ON public.inventory_items;
CREATE POLICY "Users can view inventory items"
  ON public.inventory_items FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create inventory items" ON public.inventory_items;
CREATE POLICY "Users can create inventory items"
  ON public.inventory_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update inventory items" ON public.inventory_items;
CREATE POLICY "Users can update inventory items"
  ON public.inventory_items FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete inventory items" ON public.inventory_items;
CREATE POLICY "Users can delete inventory items"
  ON public.inventory_items FOR DELETE
  TO anon, authenticated
  USING (true);

-- Step 6: Data migration and cleanup (only if source tables exist)
DO $$
BEGIN
  -- Skip all data migration if source tables don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_inventory_stock') THEN
    RAISE NOTICE 'Skipping data migration - source tables do not exist';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'master_inventory_items') THEN
    RAISE NOTICE 'Skipping data migration - master_inventory_items does not exist';
    RETURN;
  END IF;

  -- Migrate data
  INSERT INTO public.inventory_items (
    id, store_id, name, description, category, unit, brand, supplier,
    quantity_on_hand, unit_cost, reorder_level, is_active, created_at, updated_at
  )
  SELECT
    sis.id,
    sis.store_id,
    mi.name,
    mi.description,
    mi.category,
    mi.unit,
    NULL as brand,
    'Generic' as supplier,
    sis.quantity_on_hand,
    COALESCE(sis.unit_cost_override, mi.unit_cost) as unit_cost,
    COALESCE(sis.reorder_level_override, mi.reorder_level) as reorder_level,
    mi.is_active,
    sis.created_at,
    sis.updated_at
  FROM public.store_inventory_stock sis
  JOIN public.master_inventory_items mi ON mi.id = sis.item_id
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Data migration completed';
END $$;

-- Step 7: Clean up old tables
DROP TABLE IF EXISTS public.store_inventory_stock CASCADE;
DROP TABLE IF EXISTS public.master_inventory_items CASCADE;
DROP TABLE IF EXISTS public.inventory_items_old CASCADE;

-- Step 8: Add helpful comment
COMMENT ON TABLE public.inventory_items IS
  'Per-store inventory items. Each store manages its own inventory independently.
   No shared product catalog between stores. Full isolation for multi-store operations.';

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
