/*
  # Fix Ambiguous Column Reference in save_safe_balance_snapshot Function

  1. Problem
    - The `ON CONFLICT (store_id, date)` clause causes ambiguity
    - PostgreSQL can't determine if store_id/date refer to table columns or PL/pgSQL variables
    - Error: "column reference 'store_id' is ambiguous"

  2. Solution
    - Use the constraint name instead: `ON CONFLICT ON CONSTRAINT unique_store_date`
    - This explicitly references the unique constraint on (store_id, date)
    - Removes ambiguity and allows function to execute properly

  3. Impact
    - Fixes backfill_safe_balance_snapshots function
    - Allows historical balance snapshots to be created
    - Enables proper opening balance calculations
*/

-- Fix the save_safe_balance_snapshot function
CREATE OR REPLACE FUNCTION public.save_safe_balance_snapshot(
  p_store_id uuid,
  p_date date,
  p_employee_id uuid
)
RETURNS TABLE (
  id uuid,
  store_id uuid,
  date date,
  opening_balance decimal(10, 2),
  closing_balance decimal(10, 2),
  total_deposits decimal(10, 2),
  total_withdrawals decimal(10, 2),
  created_at timestamptz,
  updated_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance_data RECORD;
  v_snapshot_id uuid;
BEGIN
  -- Calculate the balance for the specified date
  SELECT * INTO v_balance_data
  FROM public.get_safe_balance_for_date(p_store_id, p_date);

  -- Insert or update the snapshot using constraint name to avoid ambiguity
  INSERT INTO public.safe_balance_history (
    store_id,
    date,
    opening_balance,
    closing_balance,
    total_deposits,
    total_withdrawals,
    created_by_id,
    updated_by_id
  )
  VALUES (
    p_store_id,
    p_date,
    v_balance_data.opening_balance,
    v_balance_data.closing_balance,
    v_balance_data.total_deposits,
    v_balance_data.total_withdrawals,
    p_employee_id,
    p_employee_id
  )
  ON CONFLICT ON CONSTRAINT unique_store_date
  DO UPDATE SET
    opening_balance = EXCLUDED.opening_balance,
    closing_balance = EXCLUDED.closing_balance,
    total_deposits = EXCLUDED.total_deposits,
    total_withdrawals = EXCLUDED.total_withdrawals,
    updated_by_id = EXCLUDED.updated_by_id,
    updated_at = now()
  RETURNING safe_balance_history.id INTO v_snapshot_id;

  -- Return the saved snapshot
  RETURN QUERY
  SELECT
    sbh.id,
    sbh.store_id,
    sbh.date,
    sbh.opening_balance,
    sbh.closing_balance,
    sbh.total_deposits,
    sbh.total_withdrawals,
    sbh.created_at,
    sbh.updated_at
  FROM public.safe_balance_history sbh
  WHERE sbh.id = v_snapshot_id;
END;
$$;

COMMENT ON FUNCTION public.save_safe_balance_snapshot IS
'Saves or updates a safe balance snapshot for a specific date.
Uses constraint name in ON CONFLICT to avoid column ambiguity issues.';
