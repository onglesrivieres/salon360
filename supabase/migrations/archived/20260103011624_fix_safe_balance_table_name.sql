/*
  # Fix Safe Balance Function Table Name

  1. Changes
    - Update get_safe_balance_for_date function to use correct table name
    - Change reference from safe_balance_snapshots to safe_balance_history
    - No other logic changes - keeps deposit-only calculation

  2. Problem
    - Function was referencing non-existent table safe_balance_snapshots
    - Actual table name is safe_balance_history
    - This caused "Failed to load safe balance data" error

  3. Impact
    - Safe Balance page will now load correctly
    - Opening balance will be calculated from previous day's closing balance
    - Deposits will be summed correctly
*/

-- Drop and recreate the function with correct table name
DROP FUNCTION IF EXISTS public.get_safe_balance_for_date(uuid, date);

CREATE OR REPLACE FUNCTION public.get_safe_balance_for_date(
  p_store_id uuid,
  p_date date
)
RETURNS TABLE (
  opening_balance numeric,
  total_deposits numeric,
  total_withdrawals numeric,
  closing_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opening_balance numeric;
  v_total_deposits numeric;
  v_total_withdrawals numeric;
  v_closing_balance numeric;
BEGIN
  -- Get opening balance from previous day's closing balance
  -- FIXED: Changed from safe_balance_snapshots to safe_balance_history
  SELECT COALESCE(closing_balance, 0) INTO v_opening_balance
  FROM public.safe_balance_history
  WHERE store_id = p_store_id
    AND date = p_date - INTERVAL '1 day';

  IF v_opening_balance IS NULL THEN
    v_opening_balance := 0;
  END IF;

  -- Calculate total deposits for the day
  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposits
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_out'
    AND category = 'Safe Deposit'
    AND status = 'approved';

  -- Withdrawals are no longer tracked
  v_total_withdrawals := 0;

  -- Calculate closing balance (opening + deposits only)
  v_closing_balance := v_opening_balance + v_total_deposits;

  RETURN QUERY SELECT v_opening_balance, v_total_deposits, v_total_withdrawals, v_closing_balance;
END;
$$;