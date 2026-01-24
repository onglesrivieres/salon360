/*
  # Fix Lot Number Race Condition

  ## Overview
  Fixes the race condition in generate_lot_number() that causes duplicate key
  violations when approving inventory transactions concurrently.

  ## Problem
  The generate_lot_number() function uses SELECT MAX() without locking, allowing
  multiple concurrent transactions to get the same sequence number and fail on
  the UNIQUE constraint: "duplicate key value violates unique constraint
  inventory_purchase_lots_lot_number_key"

  Additional issue: The query filters by store_id but the UNIQUE constraint is
  global, which can cause collisions across stores.

  ## Fix
  Apply the same proven pattern from transaction number fix (20260123134834):
  - Add pg_advisory_xact_lock() for serialization
  - Use GLOBAL lock key to match the global UNIQUE constraint
  - Remove store_id filter from MAX query for global uniqueness

  ## Security
  - SECURITY DEFINER with explicit search_path = public
  - Lock is transaction-scoped (auto-released on commit/rollback)
*/

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Recreate generate_lot_number with advisory lock to prevent race conditions
CREATE OR REPLACE FUNCTION public.generate_lot_number(
  p_store_id uuid,
  p_supplier_code text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_sequence int;
  v_prefix text;
  v_lot_number text;
  v_lock_key bigint;
BEGIN
  -- Get current year
  v_year := to_char(now(), 'YYYY');

  -- Use supplier code if provided, otherwise use 'LOT'
  v_prefix := COALESCE(p_supplier_code, 'LOT');

  -- GLOBAL lock key (not per-store!)
  -- The UNIQUE constraint on lot_number is global, so lock must be too
  -- This matches the pattern used in create_inventory_transaction_atomic
  v_lock_key := hashtext(v_prefix || '-' || v_year || '-LOT');

  -- Acquire advisory lock for this prefix+year combination
  -- Lock is automatically released when transaction commits/rolls back
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Query GLOBAL max sequence (removed store_id filter)
  -- because the UNIQUE constraint on lot_number is global
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(lot_number FROM '\\d+$') AS integer
    )
  ), 0) + 1
  INTO v_sequence
  FROM public.inventory_purchase_lots
  WHERE lot_number LIKE v_prefix || '-' || v_year || '-%';

  -- Format: PREFIX-YYYY-NNN (e.g., LOT-2026-001)
  v_lot_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::text, 3, '0');

  RETURN v_lot_number;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.generate_lot_number IS
  'Generates sequential lot numbers with format PREFIX-YYYY-NNN. Uses pg_advisory_xact_lock
   to prevent race conditions. Lock is GLOBAL (not per-store) because the UNIQUE constraint
   on lot_number is global. Fixed in migration 20260123154656_fix_lot_number_race_condition.sql';

-- ============================================================================
-- SCHEMA CACHE RELOAD
-- ============================================================================

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
