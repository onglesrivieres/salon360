/*
  # Create end_of_day_records Table

  ## Overview
  Creates the end_of_day_records table for tracking daily opening and closing cash counts by store.

  ## Changes

  ### Tables
  - `end_of_day_records` - Stores daily cash count records for each store

  ### Indexes
  - `idx_end_of_day_records_store_id` - For filtering by store
  - `idx_end_of_day_records_date` - For filtering by date
  - `idx_end_of_day_records_store_date` - For unique store/date lookups

  ### Policies
  - SELECT/INSERT/UPDATE for authenticated users

  ## Security
  - RLS enabled with policies for authenticated users
  - Foreign key constraints to stores and employees tables

  ## Notes
  - This table is required by the ensure_opening_cash_before_ticket trigger
  - One record per store per date (unique constraint)
*/

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.end_of_day_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date date NOT NULL,

  -- Opening cash amount and denominations
  opening_cash_amount numeric(10,2) DEFAULT 0,
  bill_100 integer DEFAULT 0,
  bill_50 integer DEFAULT 0,
  bill_20 integer DEFAULT 0,
  bill_10 integer DEFAULT 0,
  bill_5 integer DEFAULT 0,
  bill_2 integer DEFAULT 0,
  bill_1 integer DEFAULT 0,
  coin_25 integer DEFAULT 0,
  coin_10 integer DEFAULT 0,
  coin_5 integer DEFAULT 0,

  -- Closing cash amount and denominations
  closing_cash_amount numeric(10,2) DEFAULT 0,
  closing_bill_100 integer DEFAULT 0,
  closing_bill_50 integer DEFAULT 0,
  closing_bill_20 integer DEFAULT 0,
  closing_bill_10 integer DEFAULT 0,
  closing_bill_5 integer DEFAULT 0,
  closing_bill_2 integer DEFAULT 0,
  closing_bill_1 integer DEFAULT 0,
  closing_coin_25 integer DEFAULT 0,
  closing_coin_10 integer DEFAULT 0,
  closing_coin_5 integer DEFAULT 0,

  -- Metadata
  notes text,
  created_by uuid REFERENCES public.employees(id),
  updated_by uuid REFERENCES public.employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Unique constraint: one record per store per date
  CONSTRAINT end_of_day_records_store_date_unique UNIQUE (store_id, date)
);

-- Add comments
COMMENT ON TABLE public.end_of_day_records IS 'Daily opening and closing cash count records for each store';
COMMENT ON COLUMN public.end_of_day_records.opening_cash_amount IS 'Total opening cash amount (calculated from denominations)';
COMMENT ON COLUMN public.end_of_day_records.closing_cash_amount IS 'Total closing cash amount (calculated from denominations)';

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_end_of_day_records_store_id
  ON public.end_of_day_records(store_id);

CREATE INDEX IF NOT EXISTS idx_end_of_day_records_date
  ON public.end_of_day_records(date);

CREATE INDEX IF NOT EXISTS idx_end_of_day_records_store_date
  ON public.end_of_day_records(store_id, date);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.end_of_day_records ENABLE ROW LEVEL SECURITY;

-- SELECT policy - authenticated users can read records
DROP POLICY IF EXISTS "Authenticated users can read end_of_day_records" ON public.end_of_day_records;
CREATE POLICY "Authenticated users can read end_of_day_records"
  ON public.end_of_day_records
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT policy - authenticated users can create records
DROP POLICY IF EXISTS "Authenticated users can insert end_of_day_records" ON public.end_of_day_records;
CREATE POLICY "Authenticated users can insert end_of_day_records"
  ON public.end_of_day_records
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE policy - authenticated users can update records
DROP POLICY IF EXISTS "Authenticated users can update end_of_day_records" ON public.end_of_day_records;
CREATE POLICY "Authenticated users can update end_of_day_records"
  ON public.end_of_day_records
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.end_of_day_records TO authenticated;
