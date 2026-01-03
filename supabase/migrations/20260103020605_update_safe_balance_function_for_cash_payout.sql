/*
  # Update Safe Balance Function for Cash Payout Transaction Type

  1. Changes
    - Update get_safe_balance_for_date function to calculate withdrawals using 'cash_payout' type
    - Withdrawals now include categories: 'Payroll' and 'Tip Payout'
    - Removes dependency on 'Safe Withdrawal' category with 'cash_in' type

  2. Purpose
    - Separates safe cash payouts from End of Day cash management
    - 'cash_payout' transactions represent money leaving the safe
    - Ensures accurate safe balance calculations

  3. Impact
    - Safe balance will now track Payroll and Tip Payout withdrawals
    - Old 'Safe Withdrawal' transactions with 'cash_in' type will not be counted
    - Safe deposits remain unchanged (cash_out + 'Safe Deposit')
*/

-- Drop and recreate function with updated withdrawal calculation
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
  -- Deposits are: transaction_type = 'cash_out' AND category = 'Safe Deposit'
  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposits
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_out'
    AND category = 'Safe Deposit'
    AND status = 'approved';

  -- Calculate total withdrawals for the day
  -- Withdrawals are: transaction_type = 'cash_payout' AND category IN ('Payroll', 'Tip Payout')
  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_payout'
    AND category IN ('Payroll', 'Tip Payout')
    AND status = 'approved';

  -- Calculate closing balance: opening + deposits - withdrawals
  v_closing_balance := v_opening_balance + v_total_deposits - v_total_withdrawals;

  RETURN QUERY SELECT v_opening_balance, v_total_deposits, v_total_withdrawals, v_closing_balance;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION public.get_safe_balance_for_date IS
'Calculates safe balance for a specific date.
Deposits: cash_out + Safe Deposit category (cash leaves circulation, goes to safe)
Withdrawals: cash_payout + Payroll/Tip Payout categories (cash leaves safe for payroll/tips)
Formula: closing_balance = opening_balance + deposits - withdrawals';
