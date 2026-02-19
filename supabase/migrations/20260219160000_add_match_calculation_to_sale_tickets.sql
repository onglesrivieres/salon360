-- ============================================================================
-- Migration: Add match_calculation column to sale_tickets
-- Description: Persist the Match Calculation toggle state on each ticket so
--              the green/checkmark indicator survives page reloads and
--              ticket re-opens.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sale_tickets'
      AND column_name = 'match_calculation'
  ) THEN
    ALTER TABLE public.sale_tickets
      ADD COLUMN match_calculation boolean DEFAULT false;
  END IF;
END;
$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
