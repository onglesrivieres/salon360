/*
  # Fix Safe Balance Opening Calculation

  ## Overview
  Replaces get_previous_safe_balance to account for approved transactions
  in date gaps where no snapshots exist in safe_balance_history. This
  eliminates the need to visit every intermediate date to get correct balances.

  ## Changes

  ### Functions
  - `get_previous_safe_balance` - Now sums intermediate transactions between
    the last snapshot and the target date, so gaps in snapshot history no
    longer cause incorrect opening balances.

  ## Security
  - Function remains SECURITY DEFINER with restricted search_path

  ## Notes
  - Backward compatible: same function signature, same return type
  - Does NOT modify save_safe_balance_snapshot, get_safe_balance_for_date,
    or backfill_safe_balance_snapshots
  - Idempotent via CREATE OR REPLACE
*/

-- ============================================================================
-- FUNCTION: get_previous_safe_balance (FIXED)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_previous_safe_balance(p_store_id uuid, p_date date)
RETURNS decimal(10, 2)
SECURITY DEFINER SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_snapshot_balance decimal(10, 2);
  v_snapshot_date date;
  v_intermediate_deposits decimal(10, 2);
  v_intermediate_withdrawals decimal(10, 2);
BEGIN
  -- Step 1: Find the most recent snapshot BEFORE the target date
  SELECT sbh.closing_balance, sbh.date
  INTO v_snapshot_balance, v_snapshot_date
  FROM public.safe_balance_history sbh
  WHERE sbh.store_id = p_store_id AND sbh.date < p_date
  ORDER BY sbh.date DESC
  LIMIT 1;

  -- If no snapshot exists at all, start from zero
  IF v_snapshot_date IS NULL THEN
    v_snapshot_balance := 0;
  END IF;

  -- Step 2: Sum approved deposits between snapshot date (exclusive) and target date (exclusive)
  SELECT COALESCE(SUM(ct.amount), 0)
  INTO v_intermediate_deposits
  FROM public.cash_transactions ct
  WHERE ct.store_id = p_store_id
    AND ct.status = 'approved'
    AND ct.date > COALESCE(v_snapshot_date, '1900-01-01'::date)
    AND ct.date < p_date
    AND (
      (ct.transaction_type = 'cash_out' AND ct.category = 'Safe Deposit')
      OR ct.transaction_type = 'hq_deposit'
    );

  -- Step 3: Sum approved withdrawals between snapshot date (exclusive) and target date (exclusive)
  SELECT COALESCE(SUM(ct.amount), 0)
  INTO v_intermediate_withdrawals
  FROM public.cash_transactions ct
  WHERE ct.store_id = p_store_id
    AND ct.status = 'approved'
    AND ct.date > COALESCE(v_snapshot_date, '1900-01-01'::date)
    AND ct.date < p_date
    AND ct.transaction_type = 'cash_payout'
    AND ct.category IN ('Payroll', 'Tip Payout', 'Headquarter Deposit', 'Other');

  -- Step 4: Return snapshot balance + intermediate net change
  RETURN COALESCE(v_snapshot_balance, 0) + v_intermediate_deposits - v_intermediate_withdrawals;
END;
$$;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
