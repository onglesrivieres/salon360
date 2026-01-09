/*
  # Remove Item Codes and Enhance Suppliers Table

  ## Summary
  This migration removes the item code system from the inventory and enhances the suppliers table
  with additional fields for better management.

  ## Changes

  ### 1. Remove Code Column from master_inventory_items
  - Drop the unique constraint on code column
  - Drop the code index
  - Remove the code column entirely
  - Items will be identified by name and supplier only

  ### 2. Update Suppliers Table
  - Remove code_prefix column (no longer needed without item codes)
  - Add contact column (text, nullable) for phone/email information
  - Add notes column (text, nullable) for additional supplier information

  ### 3. Update Views
  - Recreate inventory_items view without code column

  ## Benefits
  - Simplifies inventory management by removing unnecessary code generation
  - Reduces database complexity and constraint checks
  - Improves performance by removing unique code lookups
  - Makes supplier management more practical with contact and notes fields
  - Items are identified by human-readable names instead of generated codes
*/

-- =====================================================
-- 1. DROP CODE COLUMN FROM MASTER_INVENTORY_ITEMS
-- =====================================================

-- Drop the unique constraint on code
ALTER TABLE public.master_inventory_items 
DROP CONSTRAINT IF EXISTS master_inventory_items_code_key;

-- Drop the code index
DROP INDEX IF EXISTS public.idx_master_inventory_items_code;

-- Drop the code column
ALTER TABLE public.master_inventory_items 
DROP COLUMN IF EXISTS code CASCADE;

-- =====================================================
-- 2. UPDATE SUPPLIERS TABLE (only if table exists)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
    -- Drop code_prefix column and its constraints
    ALTER TABLE public.suppliers
    DROP CONSTRAINT IF EXISTS suppliers_code_prefix_key;

    ALTER TABLE public.suppliers
    DROP COLUMN IF EXISTS code_prefix CASCADE;

    -- Add contact and notes columns
    ALTER TABLE public.suppliers
    ADD COLUMN IF NOT EXISTS contact text,
    ADD COLUMN IF NOT EXISTS notes text;
  END IF;
END $$;

-- =====================================================
-- 3. RECREATE INVENTORY_ITEMS VIEW WITHOUT CODE (only if required tables exist)
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_inventory_stock') THEN
    RAISE NOTICE 'Skipping inventory_items view - required tables do not exist';
    RETURN;
  END IF;

  -- Drop and recreate the view without code column
  DROP VIEW IF EXISTS public.inventory_items CASCADE;

  EXECUTE $view$
    CREATE VIEW public.inventory_items AS
    SELECT
      sis.id,
      sis.store_id,
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
    JOIN public.master_inventory_items mi ON mi.id = sis.item_id
  $view$;

  -- Update view comment
  COMMENT ON VIEW public.inventory_items IS
    'Backward compatibility view. Combines master items with store stock.
     Simplified without item codes for easier inventory management.';

  GRANT SELECT ON public.inventory_items TO anon, authenticated;
END $$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';