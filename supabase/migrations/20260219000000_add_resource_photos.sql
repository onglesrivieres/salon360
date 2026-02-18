/*
  # Resource Photos Storage

  ## Overview
  Adds photo storage capability for resources. Users can attach up to 3 photos per resource
  and optionally designate one as the card thumbnail.

  ## Changes

  ### Tables
  - `resource_photos` - Stores photo metadata for resource photos

  ## Security
  - RLS enabled with open access (following existing patterns)
  - Photos linked to resources via foreign key with CASCADE delete

  ## Notes
  - Max 3 photos per resource enforced at application level
  - Uses same R2 storage pipeline as ticket/inventory photos
*/

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.resource_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_resource_photos_store_id
  ON public.resource_photos(store_id);

CREATE INDEX IF NOT EXISTS idx_resource_photos_resource_id
  ON public.resource_photos(resource_id);

CREATE INDEX IF NOT EXISTS idx_resource_photos_uploaded_by
  ON public.resource_photos(uploaded_by);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.resource_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to resource_photos" ON public.resource_photos;
CREATE POLICY "Allow all access to resource_photos"
  ON public.resource_photos
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_photos TO anon, authenticated;

-- ============================================================================
-- NOTIFY POSTGREST
-- ============================================================================

NOTIFY pgrst, 'reload schema';
