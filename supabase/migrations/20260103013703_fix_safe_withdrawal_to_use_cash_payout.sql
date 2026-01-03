/*
  # Fix Safe Withdrawal Transaction Type

  1. Changes
    - Update get_safe_balance_for_date function to use cash_payout for withdrawals
    - Keep Safe Deposits as cash_out with "Safe Deposit" category
    - This separates Safe Withdrawals from End of Day system

  2. Rationale
    - Safe Withdrawals should be independent from End of Day cash_out transactions
    - Only Safe Deposits (from End of Day) should use cash_out
    - Ensures proper data flow: EOD -> Safe Deposits only, Safe Withdrawals are separate

  3. Impact
    - Withdrawal calculations now use cash_payout transaction type
    - Deposits remain unchanged (cash_out + "Safe Deposit")
    - Closing balance formula unchanged: opening_balance + deposits - withdrawals
*/

-- Drop and recreate the function with corrected withdrawal transaction type
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
  SELECT COALESCE(closing_balance, 0) INTO v_opening_balance
  FROM public.safe_balance_snapshots
  WHERE store_id = p_store_id
    AND date = p_date - INTERVAL '1 day';

  IF v_opening_balance IS NULL THEN
    v_opening_balance := 0;
  END IF;

  -- Calculate total deposits (from End of Day - cash_out with "Safe Deposit")
  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposits
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_out'
    AND category = 'Safe Deposit'
    AND status = 'approved';

  -- Calculate total withdrawals (Safe Balance only - cash_payout with "Safe Withdrawal")
  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_payout'
    AND category = 'Safe Withdrawal'
    AND status = 'approved';

  -- Calculate closing balance
  v_closing_balance := v_opening_balance + v_total_deposits - v_total_withdrawals;

  RETURN QUERY SELECT v_opening_balance, v_total_deposits, v_total_withdrawals, v_closing_balance;
END;
$$;