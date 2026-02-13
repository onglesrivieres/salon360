/*
  # Guard timer_stopped_at from being nullified

  ## Overview
  Prevents timer_stopped_at on ticket_items from being set back to NULL once set.
  This is a safety net ensuring stopped service timers never appear to restart,
  even if a partial failure occurs during ticket reopen flows.

  ## Changes

  ### Functions
  - `guard_timer_stopped_at()` - BEFORE UPDATE trigger function that silently
    preserves the old timer_stopped_at value when an UPDATE attempts to null it

  ### Triggers
  - `ticket_items_guard_timer_stopped_at` - Fires BEFORE UPDATE on ticket_items

  ## Notes
  - Silently preserves (no RAISE EXCEPTION) so existing code is not broken
  - Overwriting a non-NULL value with a different non-NULL timestamp is still allowed
    (e.g., for timestamp corrections)
  - Only blocks the specific case: OLD.timer_stopped_at IS NOT NULL AND NEW.timer_stopped_at IS NULL
*/

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_timer_stopped_at()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- If timer_stopped_at was set and the update is trying to null it, preserve the old value
  IF OLD.timer_stopped_at IS NOT NULL AND NEW.timer_stopped_at IS NULL THEN
    NEW.timer_stopped_at := OLD.timer_stopped_at;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS ticket_items_guard_timer_stopped_at ON public.ticket_items;
CREATE TRIGGER ticket_items_guard_timer_stopped_at
  BEFORE UPDATE ON public.ticket_items
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_timer_stopped_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
