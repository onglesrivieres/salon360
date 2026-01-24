/*
  # Comprehensive Safe Balance Fix

  ## Overview
  This migration fixes the Safe Balance calculation function to use the correct
  transaction types for deposits and withdrawals, and adds error logging capabilities.

  ## Changes Made

  1. **Fixed Safe Balance Calculation Logic**
     - Deposits: `transaction_type = 'cash_out'` AND `category = 'Safe Deposit'`
     - Withdrawals: `transaction_type = 'cash_payout'` AND `category = 'Safe Withdrawal'`
     - Previous bug: Both were using 'cash_out', causing withdrawals to not be counted

  2. **Added Error Logging System**
     - New table: `function_error_logs`
     - Stores function execution errors with context for debugging
     - Tracks function name, error details, parameters, store ID, and timestamp

  3. **Enhanced Function with Error Handling**
     - Added exception handling to `get_safe_balance_for_date`
     - Logs errors to `function_error_logs` table
     - Returns zeros on error to prevent crashes (while logging for investigation)

  ## Migration Consolidation
  This migration replaces and corrects the following archived migrations:
  - 20260103004419_update_safe_balance_function_remove_withdrawals.sql
  - 20260103011624_fix_safe_balance_table_name.sql
  - 20260103013223_restore_safe_withdrawals_to_balance_function.sql
  - 20260103013703_fix_safe_withdrawal_to_use_cash_payout.sql
  - 20260103014011_fix_safe_balance_table_name_reference.sql

  ## Testing
  After applying this migration, verify:
  1. Function exists: SELECT * FROM pg_proc WHERE proname = 'get_safe_balance_for_date';
  2. Error log table exists: SELECT * FROM function_error_logs LIMIT 1;
  3. Test function with valid data
  4. Check error logs if function returns unexpected results
*/

-- =====================================================================
-- PART 1: Create Error Logging System
-- =====================================================================

-- Create function error logging table
CREATE TABLE IF NOT EXISTS public.function_error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  error_message text NOT NULL,
  error_detail text,
  error_hint text,
  parameters jsonb,
  store_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  context text
);

-- Index for efficient error querying
CREATE INDEX IF NOT EXISTS idx_function_errors_function_name
  ON public.function_error_logs(function_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_function_errors_store_id
  ON public.function_error_logs(store_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_function_errors_occurred_at
  ON public.function_error_logs(occurred_at DESC);

-- Enable RLS on error logs (viewable by authenticated users)
ALTER TABLE public.function_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow view error logs" ON public.function_error_logs;
CREATE POLICY "Allow view error logs"
  ON public.function_error_logs
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow insert error logs" ON public.function_error_logs;
CREATE POLICY "Allow insert error logs"
  ON public.function_error_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- =====================================================================
-- PART 2: Fix Safe Balance Calculation Function
-- =====================================================================

-- Drop the existing function to recreate it with correct logic
DROP FUNCTION IF EXISTS public.get_safe_balance_for_date(uuid, date);

-- Recreate function with correct transaction type logic and error handling
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
  -- Withdrawals are: transaction_type = 'cash_payout' AND category = 'Safe Withdrawal'
  -- THIS IS THE CRITICAL FIX: Changed from 'cash_out' to 'cash_payout'
  BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals
    FROM public.cash_transactions
    WHERE store_id = p_store_id
      AND date = p_date
      AND transaction_type = 'cash_payout'
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

-- Add comment to function for documentation
COMMENT ON FUNCTION public.get_safe_balance_for_date IS
'Calculates safe balance for a specific date.
Deposits: cash_out + Safe Deposit category
Withdrawals: cash_payout + Safe Withdrawal category
Includes comprehensive error logging to function_error_logs table.';

-- =====================================================================
-- PART 3: Create Helper Function to View Recent Errors
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_recent_function_errors(
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  function_name text,
  error_message text,
  parameters jsonb,
  store_id uuid,
  occurred_at timestamptz,
  context text
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE sql
AS $$
  SELECT id, function_name, error_message, parameters, store_id, occurred_at, context
  FROM public.function_error_logs
  ORDER BY occurred_at DESC
  LIMIT p_limit;
$$;

-- Add comment
COMMENT ON FUNCTION public.get_recent_function_errors IS
'Returns recent function errors for debugging purposes. Default limit is 50.';