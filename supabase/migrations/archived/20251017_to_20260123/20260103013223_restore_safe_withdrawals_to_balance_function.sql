/*
  # Restore Safe Withdrawals to Balance Function

  1. Changes
    - Update get_safe_balance_for_date function to calculate withdrawals
    - Add tracking for "Safe Withdrawal" category transactions
    - Update closing_balance calculation to: opening_balance + total_deposits - total_withdrawals

  2. Rationale
    - Reintroducing withdrawal functionality for better financial control
    - Allows tracking of cash removed from the safe
    - Provides complete picture of safe balance changes

  3. Impact
    - Function now calculates actual withdrawal amounts from cash_transactions
    - Closing balance accurately reflects both deposits and withdrawals
    - No schema changes, only function logic update
*/

-- Drop and recreate the function with withdrawal calculations
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
  SELECT COALESCE(closing_balance, 0) INTO v_opening_balance
  FROM public.safe_balance_snapshots
  WHERE store_id = p_store_id
    AND date = p_date - INTERVAL '1 day';

  IF v_opening_balance IS NULL THEN
    v_opening_balance := 0;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposits
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_out'
    AND category = 'Safe Deposit'
    AND status = 'approved';

  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_out'
    AND category = 'Safe Withdrawal'
    AND status = 'approved';

  v_closing_balance := v_opening_balance + v_total_deposits - v_total_withdrawals;

  RETURN QUERY SELECT v_opening_balance, v_total_deposits, v_total_withdrawals, v_closing_balance;
END;
$$;