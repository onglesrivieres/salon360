/*
  # Inventory Transaction Item Photos

  ## Overview
  Adds photo storage capability for inventory transaction items.
  Users can photograph received items as proof of receipt during "In" transactions.

  ## Changes

  ### Tables
  - `inventory_transaction_item_photos` - Stores photo metadata per transaction item

  ## Security
  - RLS enabled with open access (following ticket_photos pattern)
  - Photos linked to transaction items via foreign key with CASCADE delete
*/

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_transaction_item_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  transaction_item_id uuid NOT NULL REFERENCES public.inventory_transaction_items(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_inv_txn_item_photos_store_id
  ON public.inventory_transaction_item_photos(store_id);

CREATE INDEX IF NOT EXISTS idx_inv_txn_item_photos_transaction_item_id
  ON public.inventory_transaction_item_photos(transaction_item_id);

CREATE INDEX IF NOT EXISTS idx_inv_txn_item_photos_uploaded_by
  ON public.inventory_transaction_item_photos(uploaded_by);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.inventory_transaction_item_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to inventory_transaction_item_photos" ON public.inventory_transaction_item_photos;
CREATE POLICY "Allow all access to inventory_transaction_item_photos"
  ON public.inventory_transaction_item_photos
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_transaction_item_photos TO anon, authenticated;

-- ============================================================================
-- NOTIFY
-- ============================================================================

NOTIFY pgrst, 'reload schema';
