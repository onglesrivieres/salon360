/*
  # Update Safe Balance Function to Remove Withdrawals

  1. Changes
    - Modify get_safe_balance_for_date function to remove withdrawal calculations
    - Safe balance now only tracks opening balance + deposits
    - Remove the total_withdrawals calculation from the function
    - Update closing_balance to: opening_balance + total_deposits

  2. Rationale
    - Simplifying the safe management system to only use "Safe Deposit" category
    - Withdrawals are no longer tracked as a separate category
    - This aligns with the frontend changes that removed withdrawal functionality

  3. Impact
    - Function will still return total_withdrawals as 0 for backward compatibility
    - Closing balance calculation simplified to only add deposits
*/

-- Drop and recreate the function with updated logic
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

  v_total_withdrawals := 0;

  v_closing_balance := v_opening_balance + v_total_deposits;

  RETURN QUERY SELECT v_opening_balance, v_total_deposits, v_total_withdrawals, v_closing_balance;
END;
$$;
