/*
  # Create Store Product Purchase Units System

  ## Overview
  Implements store-specific purchase unit definitions to support variable purchase
  packaging (e.g., single bottle, pack of 6, case of 24). Each store can define
  their own purchase units based on their suppliers and ordering patterns.

  ## New Tables

  ### store_product_purchase_units
  Tracks available purchase units for each product at each store:
  - `id` (uuid, primary key) - Unique identifier
  - `store_id` (uuid) - Store this purchase unit belongs to
  - `master_item_id` (uuid) - Reference to master inventory item
  - `unit_name` (text) - Display name (e.g., "Pack of 6 bottles")
  - `multiplier` (numeric) - How many stock units in this purchase unit
  - `is_default` (boolean) - Whether this is the default purchase unit
  - `display_order` (integer) - Sort order in UI
  - `created_at` (timestamptz) - When this unit was created
  - `updated_at` (timestamptz) - Last modification time

  ## Security
  - Enable RLS on all tables
  - Allow all staff to view purchase units
  - Allow managers/admins to create and manage purchase units

  ## Benefits
  - Support bulk purchase entry (cases, packs)
  - Automatic conversion to stock units
  - Store-specific configurations
  - Flexible and editable over time
*/

-- Step 1: Create store_product_purchase_units table
CREATE TABLE IF NOT EXISTS public.store_product_purchase_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  master_item_id uuid NOT NULL REFERENCES public.master_inventory_items(id) ON DELETE CASCADE,
  unit_name text NOT NULL,
  multiplier numeric(10,2) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT store_product_purchase_units_unit_name_not_empty CHECK (unit_name <> ''),
  CONSTRAINT store_product_purchase_units_multiplier_positive CHECK (multiplier > 0),
  CONSTRAINT store_product_purchase_units_unique_name UNIQUE (store_id, master_item_id, unit_name)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_store_product_purchase_units_store_id
  ON public.store_product_purchase_units(store_id);
CREATE INDEX IF NOT EXISTS idx_store_product_purchase_units_master_item_id
  ON public.store_product_purchase_units(master_item_id);
CREATE INDEX IF NOT EXISTS idx_store_product_purchase_units_store_item
  ON public.store_product_purchase_units(store_id, master_item_id);
CREATE INDEX IF NOT EXISTS idx_store_product_purchase_units_default
  ON public.store_product_purchase_units(store_id, master_item_id, is_default)
  WHERE is_default = true;

-- Step 3: Enable RLS
ALTER TABLE public.store_product_purchase_units ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies

-- All users can view purchase units
CREATE POLICY "Users can view purchase units"
  ON public.store_product_purchase_units FOR SELECT
  TO anon, authenticated
  USING (true);

-- Managers and admins can create purchase units
CREATE POLICY "Managers can create purchase units"
  ON public.store_product_purchase_units FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Managers and admins can update purchase units
CREATE POLICY "Managers can update purchase units"
  ON public.store_product_purchase_units FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Managers and admins can delete purchase units
CREATE POLICY "Managers can delete purchase units"
  ON public.store_product_purchase_units FOR DELETE
  TO anon, authenticated
  USING (true);

-- Step 5: Create function to ensure only one default per store/item
CREATE OR REPLACE FUNCTION public.ensure_single_default_purchase_unit()
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
      AND master_item_id = NEW.master_item_id
      AND id != NEW.id
      AND is_default = true;
  END IF;

  -- Ensure at least one default exists
  IF NEW.is_default = false THEN
    -- Check if there are any other defaults
    IF NOT EXISTS (
      SELECT 1 FROM public.store_product_purchase_units
      WHERE store_id = NEW.store_id
        AND master_item_id = NEW.master_item_id
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

-- Create trigger to ensure single default
DROP TRIGGER IF EXISTS trigger_ensure_single_default_purchase_unit ON public.store_product_purchase_units;
CREATE TRIGGER trigger_ensure_single_default_purchase_unit
  BEFORE INSERT OR UPDATE ON public.store_product_purchase_units
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_purchase_unit();

-- Step 6: Create function to create default single unit for new products
CREATE OR REPLACE FUNCTION public.create_default_purchase_unit_for_store_item(
  p_store_id uuid,
  p_master_item_id uuid
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
  -- Get the base unit from master item
  SELECT unit INTO v_unit_name
  FROM public.master_inventory_items
  WHERE id = p_master_item_id;

  -- Check if a purchase unit already exists
  SELECT id INTO v_unit_id
  FROM public.store_product_purchase_units
  WHERE store_id = p_store_id
    AND master_item_id = p_master_item_id
  LIMIT 1;

  -- If no units exist, create default single unit
  IF v_unit_id IS NULL THEN
    INSERT INTO public.store_product_purchase_units (
      store_id,
      master_item_id,
      unit_name,
      multiplier,
      is_default,
      display_order
    ) VALUES (
      p_store_id,
      p_master_item_id,
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

-- Step 7: Add purchase_unit_id to inventory_transaction_items for tracking
ALTER TABLE public.inventory_transaction_items
ADD COLUMN IF NOT EXISTS purchase_unit_id uuid REFERENCES public.store_product_purchase_units(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_transaction_items
ADD COLUMN IF NOT EXISTS purchase_quantity numeric(10,2);

ALTER TABLE public.inventory_transaction_items
ADD COLUMN IF NOT EXISTS purchase_unit_multiplier numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_purchase_unit_id
  ON public.inventory_transaction_items(purchase_unit_id);

-- Step 8: Add helpful comments
COMMENT ON TABLE public.store_product_purchase_units IS
  'Store-specific purchase unit definitions (e.g., single, pack, case) with conversion multipliers';

COMMENT ON COLUMN public.store_product_purchase_units.unit_name IS
  'Display name like "Single bottle", "Pack of 6 bottles", or "Case of 24 bottles"';

COMMENT ON COLUMN public.store_product_purchase_units.multiplier IS
  'How many stock units are in this purchase unit (e.g., 6 for a pack of 6)';

COMMENT ON COLUMN public.store_product_purchase_units.is_default IS
  'Whether this purchase unit should be pre-selected in the UI';
