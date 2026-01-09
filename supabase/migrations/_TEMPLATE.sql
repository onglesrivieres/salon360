/*
  # [Migration Title - Brief Description]

  ## Overview
  [1-2 sentence description of what this migration does]

  ## Changes

  ### Tables
  - `table_name` - [Description of changes]

  ### Functions
  - `function_name` - [Description]

  ### Triggers
  - `trigger_name` - [Description]

  ### Policies
  - [Policy descriptions]

  ## Security
  - [Security considerations]

  ## Notes
  - [Any important notes or dependencies]
*/

-- ============================================================================
-- TABLES
-- ============================================================================

-- Create table with IF NOT EXISTS for idempotency
CREATE TABLE IF NOT EXISTS public.example_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  -- Add columns here
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add columns idempotently using DO blocks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'example_table'
      AND column_name = 'new_column'
  ) THEN
    ALTER TABLE public.example_table ADD COLUMN new_column text;
  END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_example_table_store_id
  ON public.example_table(store_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Always use CREATE OR REPLACE for functions
CREATE OR REPLACE FUNCTION public.example_function(p_param uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Function body
  NULL;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Always DROP IF EXISTS before CREATE for triggers
DROP TRIGGER IF EXISTS example_trigger ON public.example_table;
CREATE TRIGGER example_trigger
  BEFORE UPDATE ON public.example_table
  FOR EACH ROW
  EXECUTE FUNCTION public.example_function();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.example_table ENABLE ROW LEVEL SECURITY;

-- Always DROP IF EXISTS before CREATE for policies
DROP POLICY IF EXISTS "Policy name" ON public.example_table;
CREATE POLICY "Policy name"
  ON public.example_table
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON public.example_table TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.example_table TO authenticated;

-- ============================================================================
-- SEED DATA (if needed)
-- ============================================================================

-- Use ON CONFLICT DO NOTHING or ON CONFLICT DO UPDATE for idempotency
-- INSERT INTO public.example_table (id, store_id)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'store-uuid-here')
-- ON CONFLICT (id) DO NOTHING;
