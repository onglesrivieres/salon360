/*
  # Ticket Photos Storage

  ## Overview
  Adds photo storage capability for ticket final product photos. Users can take or attach up to 5 photos per ticket.

  ## Changes

  ### Tables
  - `ticket_photos` - Stores photo metadata for ticket photos

  ## Security
  - RLS enabled with open access (following existing patterns)
  - Photos linked to tickets via foreign key

  ## Notes
  - Requires Supabase Storage bucket `salon360-photos` to be created manually
  - Max 5 photos per ticket enforced at application level
*/

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ticket_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.sale_tickets(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_ticket_photos_store_id
  ON public.ticket_photos(store_id);

CREATE INDEX IF NOT EXISTS idx_ticket_photos_ticket_id
  ON public.ticket_photos(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_photos_uploaded_by
  ON public.ticket_photos(uploaded_by);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.ticket_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to ticket_photos" ON public.ticket_photos;
CREATE POLICY "Allow all access to ticket_photos"
  ON public.ticket_photos
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_photos TO anon, authenticated;
