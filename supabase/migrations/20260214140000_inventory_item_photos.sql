/*
  # Inventory Item Photos Storage

  ## Overview
  Adds photo storage capability for inventory item product photos. Users can attach up to 5 photos per item (standalone and sub-items only).

  ## Changes

  ### Tables
  - `inventory_item_photos` - Stores photo metadata for inventory item photos

  ## Security
  - RLS enabled with open access (following existing patterns)
  - Photos linked to inventory_items via foreign key with CASCADE delete
*/

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_item_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  filename text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  display_order integer DEFAULT 0,
  uploaded_by uuid NOT NULL REFERENCES public.employees(id),
  caption text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_item_photos_store_id
  ON public.inventory_item_photos(store_id);

CREATE INDEX IF NOT EXISTS idx_inventory_item_photos_item_id
  ON public.inventory_item_photos(item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_item_photos_uploaded_by
  ON public.inventory_item_photos(uploaded_by);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.inventory_item_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to inventory_item_photos" ON public.inventory_item_photos;
CREATE POLICY "Allow all access to inventory_item_photos"
  ON public.inventory_item_photos
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_item_photos TO anon, authenticated;

-- ============================================================================
-- NOTIFY POSTGREST
-- ============================================================================

NOTIFY pgrst, 'reload schema';
