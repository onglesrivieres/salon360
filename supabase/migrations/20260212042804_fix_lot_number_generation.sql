-- Fix generate_lot_number() regression from migration squash
-- Bug 1: Missing advisory lock allows concurrent approvals to generate duplicate lot numbers
-- Bug 2: Store-scoped WHERE clause conflicts with global UNIQUE constraint on lot_number
-- Bug 3: Missing p_offset parameter (3rd arg) causes call failures from create_lots_from_approved_transaction
-- Restored from proven fix in archived migration 20260123160544

-- Drop old 2-param signature first (CREATE OR REPLACE won't replace a different signature)
DROP FUNCTION IF EXISTS public.generate_lot_number(uuid, text);

CREATE OR REPLACE FUNCTION public.generate_lot_number(
  p_store_id uuid,
  p_supplier_code text DEFAULT NULL,
  p_offset int DEFAULT 0
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

  -- GLOBAL lock key (not per-store) - matches global UNIQUE constraint
  v_lock_key := hashtext(v_prefix || '-' || v_year || '-LOT');

  -- Acquire advisory lock for this prefix+year combination
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Query GLOBAL max (no store_id filter) and add offset for this item
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(lot_number FROM '\d+$') AS integer
    )
  ), 0) + 1 + p_offset
  INTO v_sequence
  FROM public.inventory_purchase_lots
  WHERE lot_number LIKE v_prefix || '-' || v_year || '-%';

  -- Format: PREFIX-YYYY-NNN (e.g., LOT-2026-001)
  v_lot_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::text, 3, '0');

  RETURN v_lot_number;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
