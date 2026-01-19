/*
  # Add 'Other' Category to Safe Balance Withdrawals Calculation

  This migration updates the get_safe_balance_for_date function to include
  'Other' in the withdrawal categories, so that withdrawals with 'Other'
  category are counted in Total Withdrawals and Current Balance.

  Previously: Only 'Payroll', 'Tip Payout', 'Headquarter Deposit' were counted
  Now: 'Other' is also included in the calculation
*/

DROP FUNCTION IF EXISTS public.get_safe_balance_for_date(uuid, date);

CREATE OR REPLACE FUNCTION public.get_safe_balance_for_date(
  p_store_id uuid,
  p_date date
)
RETURNS TABLE (
  opening_balance decimal(10, 2),
  total_deposits decimal(10, 2),
  total_withdrawals decimal(10, 2),
  closing_balance decimal(10, 2)
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_opening_balance decimal(10, 2);
  v_total_deposits decimal(10, 2);
  v_total_withdrawals decimal(10, 2);
  v_closing_balance decimal(10, 2);
BEGIN
  -- Get opening balance from previous day's closing balance
  v_opening_balance := public.get_previous_safe_balance(p_store_id, p_date);

  -- Calculate total deposits for the day
  -- Deposits are:
  --   1. transaction_type = 'cash_out' AND category = 'Safe Deposit' (regular safe deposits)
  --   2. transaction_type = 'hq_deposit' (HQ deposits from branches - skips EOD)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposits
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND (
      (transaction_type = 'cash_out' AND category = 'Safe Deposit')
      OR transaction_type = 'hq_deposit'
    )
    AND status = 'approved';

  -- Calculate total withdrawals for the day
  -- Withdrawals are: transaction_type = 'cash_payout' AND category IN ('Payroll', 'Tip Payout', 'Headquarter Deposit', 'Other')
  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_payout'
    AND category IN ('Payroll', 'Tip Payout', 'Headquarter Deposit', 'Other')
    AND status = 'approved';

  -- Calculate closing balance: opening + deposits - withdrawals
  v_closing_balance := v_opening_balance + v_total_deposits - v_total_withdrawals;

  RETURN QUERY SELECT v_opening_balance, v_total_deposits, v_total_withdrawals, v_closing_balance;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION public.get_safe_balance_for_date IS
'Calculates safe balance for a specific date.
Deposits:
  - cash_out + Safe Deposit category (regular safe deposits from EOD)
  - hq_deposit type (HQ deposits from branches - skips EOD)
Withdrawals: cash_payout + Payroll/Tip Payout/Headquarter Deposit/Other categories
Formula: closing_balance = opening_balance + deposits - withdrawals';
