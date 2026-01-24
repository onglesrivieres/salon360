/*
  # Comprehensive Fix: Purchase Units System - Use item_id

  ## Problem
  Error when approving inventory transactions or creating sub-items:
  "Item 1: Failed to save purchase unit - column 'master_item_id' does not exist"

  ## Root Cause
  Multiple functions and triggers reference `master_item_id` which no longer exists
  after the schema migration from centralized master items to per-store inventory.

  ## Fix
  1. Ensure item_id column exists in store_product_purchase_units
  2. DROP and recreate ensure_single_default_purchase_unit() to use item_id
  3. DROP and recreate create_default_purchase_unit_for_store_item() to use item_id
  4. Recreate triggers
  5. Force schema cache reload
*/

-- =====================================================
-- Step 1: Ensure item_id column exists
-- =====================================================
ALTER TABLE public.store_product_purchase_units
ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_store_product_purchase_units_item_id
ON public.store_product_purchase_units(item_id);

CREATE INDEX IF NOT EXISTS idx_store_product_purchase_units_store_item_id
ON public.store_product_purchase_units(store_id, item_id);

-- =====================================================
-- Step 2: Drop existing trigger first (to avoid dependency issues)
-- =====================================================
DROP TRIGGER IF EXISTS trigger_ensure_single_default_purchase_unit ON public.store_product_purchase_units;

-- =====================================================
-- Step 3: Drop and recreate ensure_single_default_purchase_unit
-- Uses item_id instead of master_item_id
-- =====================================================
DROP FUNCTION IF EXISTS public.ensure_single_default_purchase_unit() CASCADE;

CREATE FUNCTION public.ensure_single_default_purchase_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If setting this as default, unset all other defaults for this store/item
  IF NEW.is_default = true THEN
    UPDATE public.store_product_purchase_units
    SET is_default = false, updated_at = now()
    WHERE store_id = NEW.store_id
      AND item_id = NEW.item_id
      AND id != NEW.id
      AND is_default = true;
  END IF;

  -- Ensure at least one default exists
  IF NEW.is_default = false THEN
    -- Check if there are any other defaults
    IF NOT EXISTS (
      SELECT 1 FROM public.store_product_purchase_units
      WHERE store_id = NEW.store_id
        AND item_id = NEW.item_id
        AND id != NEW.id
        AND is_default = true
    ) THEN
      -- If no other defaults, keep this one as default
      NEW.is_default := true;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- Step 4: Recreate the trigger
-- =====================================================
CREATE TRIGGER trigger_ensure_single_default_purchase_unit
  BEFORE INSERT OR UPDATE ON public.store_product_purchase_units
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_purchase_unit();

-- =====================================================
-- Step 5: Drop and recreate create_default_purchase_unit_for_store_item
-- Uses item_id instead of master_item_id
-- =====================================================
DROP FUNCTION IF EXISTS public.create_default_purchase_unit_for_store_item(uuid, uuid) CASCADE;

CREATE FUNCTION public.create_default_purchase_unit_for_store_item(
  p_store_id uuid,
  p_item_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id uuid;
  v_unit_name text;
BEGIN
  -- Get the base unit from inventory item
  SELECT unit INTO v_unit_name
  FROM public.inventory_items
  WHERE id = p_item_id;

  -- Check if a purchase unit already exists
  SELECT id INTO v_unit_id
  FROM public.store_product_purchase_units
  WHERE store_id = p_store_id
    AND item_id = p_item_id
  LIMIT 1;

  -- If no units exist, create default single unit
  IF v_unit_id IS NULL THEN
    INSERT INTO public.store_product_purchase_units (
      store_id,
      item_id,
      unit_name,
      multiplier,
      is_default,
      display_order
    ) VALUES (
      p_store_id,
      p_item_id,
      'Single ' || COALESCE(v_unit_name, 'unit'),
      1,
      true,
      0
    )
    RETURNING id INTO v_unit_id;
  END IF;

  RETURN v_unit_id;
END;
$$;

-- =====================================================
-- Step 6: Add comments
-- =====================================================
COMMENT ON FUNCTION public.ensure_single_default_purchase_unit IS
  'Ensures only one default purchase unit per store/item. Uses item_id (not master_item_id).';

COMMENT ON FUNCTION public.create_default_purchase_unit_for_store_item IS
  'Creates a default purchase unit for a store item if none exists. Uses item_id (not master_item_id).';

-- =====================================================
-- Step 7: Force PostgREST to reload schema cache
-- =====================================================
NOTIFY pgrst, 'reload schema';
