/*
  # Add Inventory Item Hierarchy (Master Item / Sub-Item)

  ## Overview
  Adds parent-child relationship support to inventory items for grouping
  variations (brand, supplier, size, color) under master items.

  ## Changes

  ### Tables
  - `master_inventory_items` - Add parent_id, is_master_item, size, color_code columns

  ### Functions
  - `get_sub_items` - Get all sub-items for a master item
  - `get_master_item_total_quantity` - Sum of all sub-item quantities
  - `master_item_has_low_stock` - Check if any sub-item is below reorder level

  ## Security
  - Uses existing RLS policies on master_inventory_items

  ## Notes
  - Existing items remain as standalone items (is_master_item = false, parent_id = null)
  - Master items serve as grouping containers only - no inventory quantities
  - Sub-items inherit category and unit from parent master item
*/

-- ============================================================================
-- ADD COLUMNS TO master_inventory_items
-- ============================================================================

-- Add parent_id column (self-referential foreign key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'master_inventory_items'
      AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE public.master_inventory_items
    ADD COLUMN parent_id uuid REFERENCES public.master_inventory_items(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add is_master_item flag (true = grouping item, no quantities)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'master_inventory_items'
      AND column_name = 'is_master_item'
  ) THEN
    ALTER TABLE public.master_inventory_items
    ADD COLUMN is_master_item boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add size column for sub-item variations (e.g., "Small", "Medium", "Large")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'master_inventory_items'
      AND column_name = 'size'
  ) THEN
    ALTER TABLE public.master_inventory_items
    ADD COLUMN size text;
  END IF;
END $$;

-- Add color_code column for sub-item variations (e.g., "66", "67", "68")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'master_inventory_items'
      AND column_name = 'color_code'
  ) THEN
    ALTER TABLE public.master_inventory_items
    ADD COLUMN color_code text;
  END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for parent_id lookups (finding sub-items of a master item)
CREATE INDEX IF NOT EXISTS idx_master_inventory_items_parent_id
ON public.master_inventory_items(parent_id)
WHERE parent_id IS NOT NULL;

-- Index for filtering master items
CREATE INDEX IF NOT EXISTS idx_master_inventory_items_is_master
ON public.master_inventory_items(is_master_item)
WHERE is_master_item = true;

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

-- Master items cannot have a parent (only sub-items can have parents)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
      AND table_name = 'master_inventory_items'
      AND constraint_name = 'master_inventory_items_master_no_parent'
  ) THEN
    ALTER TABLE public.master_inventory_items
    ADD CONSTRAINT master_inventory_items_master_no_parent
    CHECK (NOT (is_master_item = true AND parent_id IS NOT NULL));
  END IF;
END $$;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Get all sub-items for a master item
CREATE OR REPLACE FUNCTION public.get_sub_items(p_master_item_id uuid)
RETURNS SETOF public.master_inventory_items
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM public.master_inventory_items
  WHERE parent_id = p_master_item_id
  AND is_active = true
  ORDER BY brand, name, size, color_code;
$$;

-- Calculate total quantity for a master item (sum of all sub-items)
CREATE OR REPLACE FUNCTION public.get_master_item_total_quantity(
  p_master_item_id uuid,
  p_store_id uuid
)
RETURNS numeric(10,2)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(sis.quantity_on_hand), 0)
  FROM public.master_inventory_items mi
  JOIN public.store_inventory_stock sis ON sis.item_id = mi.id
  WHERE mi.parent_id = p_master_item_id
  AND mi.is_active = true
  AND sis.store_id = p_store_id;
$$;

-- Check if any sub-items are below reorder level
CREATE OR REPLACE FUNCTION public.master_item_has_low_stock(
  p_master_item_id uuid,
  p_store_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.master_inventory_items mi
    JOIN public.store_inventory_stock sis ON sis.item_id = mi.id
    WHERE mi.parent_id = p_master_item_id
    AND mi.is_active = true
    AND sis.store_id = p_store_id
    AND sis.quantity_on_hand <= COALESCE(sis.reorder_level_override, mi.reorder_level)
  );
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_sub_items(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_master_item_total_quantity(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.master_item_has_low_stock(uuid, uuid) TO authenticated;
