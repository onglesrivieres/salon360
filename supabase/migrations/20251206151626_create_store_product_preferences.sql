/*
  # Create Store Product Preferences System

  ## Overview
  Tracks user preferences for inventory products at each store, specifically
  remembering the last-used purchase unit to speed up data entry for repeat orders.

  ## New Tables

  ### store_product_preferences
  Tracks the last-used purchase unit and related preferences:
  - `id` (uuid, primary key) - Unique identifier
  - `store_id` (uuid) - Store this preference applies to
  - `master_item_id` (uuid) - Reference to master inventory item
  - `last_used_purchase_unit_id` (uuid) - Last purchase unit used for this product
  - `last_purchase_cost` (numeric) - Last purchase cost per stock unit
  - `last_used_at` (timestamptz) - When this preference was last updated
  - `updated_by_id` (uuid) - Employee who last used this
  - `created_at` (timestamptz) - When this preference was first created
  - `updated_at` (timestamptz) - Last modification time

  ## Security
  - Enable RLS on table
  - Allow all staff to view and update preferences

  ## Benefits
  - Remember last-used purchase unit per product per store
  - Speed up data entry for repeat orders
  - Track purchasing patterns
*/

-- Step 1: Create store_product_preferences table
CREATE TABLE IF NOT EXISTS public.store_product_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  master_item_id uuid NOT NULL REFERENCES public.master_inventory_items(id) ON DELETE CASCADE,
  last_used_purchase_unit_id uuid REFERENCES public.store_product_purchase_units(id) ON DELETE SET NULL,
  last_purchase_cost numeric(10,2) DEFAULT 0,
  last_used_at timestamptz DEFAULT now(),
  updated_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT store_product_preferences_unique_store_item UNIQUE (store_id, master_item_id),
  CONSTRAINT store_product_preferences_last_purchase_cost_non_negative CHECK (last_purchase_cost >= 0)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_store_product_preferences_store_id
  ON public.store_product_preferences(store_id);
CREATE INDEX IF NOT EXISTS idx_store_product_preferences_master_item_id
  ON public.store_product_preferences(master_item_id);
CREATE INDEX IF NOT EXISTS idx_store_product_preferences_store_item
  ON public.store_product_preferences(store_id, master_item_id);
CREATE INDEX IF NOT EXISTS idx_store_product_preferences_last_used_at
  ON public.store_product_preferences(last_used_at DESC);

-- Step 3: Enable RLS
ALTER TABLE public.store_product_preferences ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies

-- All users can view preferences
CREATE POLICY "Users can view product preferences"
  ON public.store_product_preferences FOR SELECT
  TO anon, authenticated
  USING (true);

-- All users can insert preferences (for first-time use)
CREATE POLICY "Users can create product preferences"
  ON public.store_product_preferences FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- All users can update preferences
CREATE POLICY "Users can update product preferences"
  ON public.store_product_preferences FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Step 5: Create function to update product preferences
CREATE OR REPLACE FUNCTION public.update_product_preference(
  p_store_id uuid,
  p_master_item_id uuid,
  p_purchase_unit_id uuid,
  p_unit_cost numeric,
  p_employee_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update the preference
  INSERT INTO public.store_product_preferences (
    store_id,
    master_item_id,
    last_used_purchase_unit_id,
    last_purchase_cost,
    last_used_at,
    updated_by_id,
    updated_at
  ) VALUES (
    p_store_id,
    p_master_item_id,
    p_purchase_unit_id,
    p_unit_cost,
    now(),
    p_employee_id,
    now()
  )
  ON CONFLICT (store_id, master_item_id)
  DO UPDATE SET
    last_used_purchase_unit_id = EXCLUDED.last_used_purchase_unit_id,
    last_purchase_cost = EXCLUDED.last_purchase_cost,
    last_used_at = EXCLUDED.last_used_at,
    updated_by_id = EXCLUDED.updated_by_id,
    updated_at = now();
END;
$$;

-- Step 6: Create function to get product preference with fallback
CREATE OR REPLACE FUNCTION public.get_product_preference(
  p_store_id uuid,
  p_master_item_id uuid
)
RETURNS TABLE (
  purchase_unit_id uuid,
  purchase_cost numeric,
  last_used timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    spp.last_used_purchase_unit_id as purchase_unit_id,
    spp.last_purchase_cost as purchase_cost,
    spp.last_used_at as last_used
  FROM public.store_product_preferences spp
  WHERE spp.store_id = p_store_id
    AND spp.master_item_id = p_master_item_id
  LIMIT 1;
END;
$$;

-- Step 7: Add helpful comments
COMMENT ON TABLE public.store_product_preferences IS
  'Tracks last-used purchase units and preferences per product per store for faster data entry';

COMMENT ON COLUMN public.store_product_preferences.last_used_purchase_unit_id IS
  'The purchase unit (single, pack, case) that was last used when ordering this product';

COMMENT ON COLUMN public.store_product_preferences.last_purchase_cost IS
  'The last purchase cost per stock unit, useful for comparison and anomaly detection';

COMMENT ON FUNCTION public.update_product_preference IS
  'Updates or creates product preference after a transaction, remembering the purchase unit used';

COMMENT ON FUNCTION public.get_product_preference IS
  'Retrieves the last-used purchase unit for a product to pre-populate the transaction form';
