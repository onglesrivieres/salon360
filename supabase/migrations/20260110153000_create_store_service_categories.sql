/*
  # Create Store Service Categories System

  ## Overview
  Implements store-specific service category management to standardize
  category naming and enable dropdown selection with "Add New" capability.
  Each store can have its own separate list of categories.

  ## New Table: store_service_categories
  - `id` (uuid, primary key) - Unique identifier
  - `store_id` (uuid) - Store this category belongs to
  - `name` (text) - Category name
  - `color` (text) - Category color key (pink, blue, purple, green, yellow)
  - `display_order` (integer) - Sort order in UI
  - `is_active` (boolean) - Whether category is available for selection
  - `created_at` / `updated_at` timestamps

  ## Security
  - Enable RLS on table
  - Allow all staff to view categories
  - Allow staff to create and manage categories
*/

-- Step 1: Create store_service_categories table
CREATE TABLE IF NOT EXISTS public.store_service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'pink',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT store_service_categories_name_not_empty CHECK (name <> ''),
  CONSTRAINT store_service_categories_valid_color CHECK (color IN ('pink', 'blue', 'purple', 'green', 'yellow')),
  CONSTRAINT store_service_categories_unique_name UNIQUE (store_id, name)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_store_service_categories_store_id
  ON public.store_service_categories(store_id);
CREATE INDEX IF NOT EXISTS idx_store_service_categories_store_active
  ON public.store_service_categories(store_id, is_active)
  WHERE is_active = true;

-- Step 3: Enable RLS
ALTER TABLE public.store_service_categories ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies

-- Authenticated users can view categories for their stores
CREATE POLICY "Users can view service categories"
  ON public.store_service_categories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.store_staff
      WHERE store_staff.store_id = store_service_categories.store_id
      AND store_staff.employee_id = (auth.jwt() ->> 'user_id')::uuid
    )
  );

-- Staff can create categories for their stores
CREATE POLICY "Staff can create service categories"
  ON public.store_service_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.store_staff
      WHERE store_staff.store_id = store_service_categories.store_id
      AND store_staff.employee_id = (auth.jwt() ->> 'user_id')::uuid
    )
  );

-- Staff can update categories for their stores
CREATE POLICY "Staff can update service categories"
  ON public.store_service_categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.store_staff
      WHERE store_staff.store_id = store_service_categories.store_id
      AND store_staff.employee_id = (auth.jwt() ->> 'user_id')::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.store_staff
      WHERE store_staff.store_id = store_service_categories.store_id
      AND store_staff.employee_id = (auth.jwt() ->> 'user_id')::uuid
    )
  );

-- Staff can delete categories for their stores
CREATE POLICY "Staff can delete service categories"
  ON public.store_service_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.store_staff
      WHERE store_staff.store_id = store_service_categories.store_id
      AND store_staff.employee_id = (auth.jwt() ->> 'user_id')::uuid
    )
  );

-- Step 5: Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_store_service_categories_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_store_service_categories_updated_at ON public.store_service_categories;
CREATE TRIGGER trigger_store_service_categories_updated_at
  BEFORE UPDATE ON public.store_service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_store_service_categories_updated_at();

-- Step 6: Seed initial categories from existing store_services data
-- Each store gets its own unique categories based on their existing services
INSERT INTO public.store_service_categories (store_id, name, display_order)
SELECT DISTINCT
  store_id,
  category,
  ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY category) - 1 as display_order
FROM public.store_services
WHERE category IS NOT NULL AND category <> ''
ON CONFLICT (store_id, name) DO NOTHING;

-- Step 6b: Set colors for seeded categories based on their names
UPDATE public.store_service_categories SET color = 'blue' WHERE name ILIKE '%pédicure%' OR name ILIKE '%pedicure%';
UPDATE public.store_service_categories SET color = 'pink' WHERE name ILIKE '%manucure%' OR name ILIKE '%manicure%';
UPDATE public.store_service_categories SET color = 'purple' WHERE name ILIKE '%extension%';
UPDATE public.store_service_categories SET color = 'green' WHERE name = 'Others';

-- Step 7: Add helpful comments
COMMENT ON TABLE public.store_service_categories IS
  'Store-specific service category definitions for dropdown selection';

COMMENT ON COLUMN public.store_service_categories.store_id IS
  'Foreign key to stores - each store has its own separate categories';

COMMENT ON COLUMN public.store_service_categories.name IS
  'Display name like "Extensions des Ongles", "Manicure", "Pedicure"';

COMMENT ON COLUMN public.store_service_categories.display_order IS
  'Sort order for dropdown display (lower numbers appear first)';

COMMENT ON COLUMN public.store_service_categories.color IS
  'Category color key: pink, blue, purple, green, yellow';
