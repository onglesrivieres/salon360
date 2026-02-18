/*
  # Cash Transaction Photos

  ## Overview
  Adds photo storage capability for cash transaction withdrawals.
  Allows attaching proof-of-withdrawal photos (receipts, etc.) to safe withdrawals.

  ## Changes

  ### Tables
  - `cash_transaction_photos` - Stores photo metadata for cash transaction photos

  ## Security
  - RLS enabled with open access (following ticket_photos pattern)
  - Photos linked to cash_transactions via foreign key with CASCADE delete

  ## Notes
  - Max 3 photos per transaction enforced at application level
  - Uses same R2 storage bucket as ticket/inventory photos
*/

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cash_transaction_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cash_transaction_id uuid NOT NULL REFERENCES public.cash_transactions(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_cash_transaction_photos_store_id
  ON public.cash_transaction_photos(store_id);

CREATE INDEX IF NOT EXISTS idx_cash_transaction_photos_cash_transaction_id
  ON public.cash_transaction_photos(cash_transaction_id);

CREATE INDEX IF NOT EXISTS idx_cash_transaction_photos_uploaded_by
  ON public.cash_transaction_photos(uploaded_by);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.cash_transaction_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to cash_transaction_photos" ON public.cash_transaction_photos;
CREATE POLICY "Allow all access to cash_transaction_photos"
  ON public.cash_transaction_photos
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_transaction_photos TO anon, authenticated;

-- ============================================================================
-- NOTIFY POSTGREST
-- ============================================================================

NOTIFY pgrst, 'reload schema';
