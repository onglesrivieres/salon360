/*
  # Fix Safe Withdrawal Transaction Type

  ## Issue
  The comprehensive safe balance fix migration incorrectly used 'cash_payout' for withdrawals,
  but the cash_transactions table only allows 'cash_in' and 'cash_out' transaction types.

  ## Correct Logic
  - Safe Deposit: 'cash_out' + 'Safe Deposit' category (cash leaves circulation, goes to safe)
  - Safe Withdrawal: 'cash_in' + 'Safe Withdrawal' category (cash enters circulation, comes from safe)

  ## Changes
  This migration recreates the get_safe_balance_for_date function with the correct transaction type.
*/

-- Drop and recreate function with correct transaction type for withdrawals
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
  v_error_message text;
BEGIN
  -- Get opening balance from previous day's closing balance
  BEGIN
    v_opening_balance := public.get_previous_safe_balance(p_store_id, p_date);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    INSERT INTO public.function_error_logs (
      function_name, error_message, parameters, store_id, context
    ) VALUES (
      'get_safe_balance_for_date',
      'Error getting previous balance: ' || v_error_message,
      jsonb_build_object('store_id', p_store_id, 'date', p_date),
      p_store_id,
      'get_previous_safe_balance'
    );
    v_opening_balance := 0;
  END;

  -- Calculate total deposits for the day
  -- Deposits are: transaction_type = 'cash_out' AND category = 'Safe Deposit'
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_deposits
    FROM public.cash_transactions
    WHERE store_id = p_store_id
      AND date = p_date
      AND transaction_type = 'cash_out'
      AND category = 'Safe Deposit'
      AND status = 'approved';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    INSERT INTO public.function_error_logs (
      function_name, error_message, parameters, store_id, context
    ) VALUES (
      'get_safe_balance_for_date',
      'Error calculating deposits: ' || v_error_message,
      jsonb_build_object('store_id', p_store_id, 'date', p_date),
      p_store_id,
      'calculate_deposits'
    );
    v_total_deposits := 0;
  END;

  -- Calculate total withdrawals for the day
  -- FIXED: Withdrawals are transaction_type = 'cash_in' AND category = 'Safe Withdrawal'
  -- This represents cash coming back into circulation from the safe
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals
    FROM public.cash_transactions
    WHERE store_id = p_store_id
      AND date = p_date
      AND transaction_type = 'cash_in'
      AND category = 'Safe Withdrawal'
      AND status = 'approved';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    INSERT INTO public.function_error_logs (
      function_name, error_message, parameters, store_id, context
    ) VALUES (
      'get_safe_balance_for_date',
      'Error calculating withdrawals: ' || v_error_message,
      jsonb_build_object('store_id', p_store_id, 'date', p_date),
      p_store_id,
      'calculate_withdrawals'
    );
    v_total_withdrawals := 0;
  END;

  -- Calculate closing balance
  v_closing_balance := v_opening_balance + v_total_deposits - v_total_withdrawals;

  -- Return the results
  RETURN QUERY SELECT v_opening_balance, v_total_deposits, v_total_withdrawals, v_closing_balance;

EXCEPTION WHEN OTHERS THEN
  -- Log any unexpected errors
  GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
  INSERT INTO public.function_error_logs (
    function_name, error_message, parameters, store_id, context
  ) VALUES (
    'get_safe_balance_for_date',
    'Unexpected error: ' || v_error_message,
    jsonb_build_object('store_id', p_store_id, 'date', p_date),
    p_store_id,
    'general_error'
  );

  -- Return zeros to prevent crashes
  RETURN QUERY SELECT
    0::decimal(10, 2) as opening_balance,
    0::decimal(10, 2) as total_deposits,
    0::decimal(10, 2) as total_withdrawals,
    0::decimal(10, 2) as closing_balance;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION public.get_safe_balance_for_date IS
'Calculates safe balance for a specific date.
Deposits: cash_out + Safe Deposit category (cash leaves circulation, goes to safe)
Withdrawals: cash_in + Safe Withdrawal category (cash enters circulation, comes from safe)
Includes comprehensive error logging to function_error_logs table.';