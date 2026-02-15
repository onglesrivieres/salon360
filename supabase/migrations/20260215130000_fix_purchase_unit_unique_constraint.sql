-- Fix: Allow purchase units with same name but different multipliers
-- e.g., "box" (x400) and "box" (x800) for the same item
-- Old constraint: UNIQUE (store_id, item_id, unit_name)
-- New constraint: UNIQUE (store_id, item_id, unit_name, multiplier)

-- Drop old name-only unique constraints
ALTER TABLE public.store_product_purchase_units
  DROP CONSTRAINT IF EXISTS store_product_purchase_units_unique_name;
ALTER TABLE public.store_product_purchase_units
  DROP CONSTRAINT IF EXISTS store_product_purchase_units_unique_item_name;

-- Add new constraint: same name allowed if multiplier differs
ALTER TABLE public.store_product_purchase_units
  ADD CONSTRAINT store_product_purchase_units_unique_item_name_multiplier
  UNIQUE (store_id, item_id, unit_name, multiplier);

NOTIFY pgrst, 'reload schema';
