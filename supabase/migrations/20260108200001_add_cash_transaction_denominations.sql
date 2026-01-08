/*
  # Add Denomination Columns to Cash Transactions

  1. Purpose
    - Add cash count denomination fields to cash_transactions table
    - Allows tracking how cash was counted for each transaction
    - Matches the structure used in end_of_day_records for opening/closing cash

  2. Changes
    - Add 10 denomination columns (bill_100 through coin_5)
    - Update create_cash_transaction_with_validation function to accept denominations

  3. Notes
    - All columns default to 0 for backward compatibility
    - Amount field continues to store the total (calculated from denominations)
*/

-- Add denomination columns to cash_transactions table
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS bill_100 integer NOT NULL DEFAULT 0;
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS bill_50 integer NOT NULL DEFAULT 0;
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS bill_20 integer NOT NULL DEFAULT 0;
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS bill_10 integer NOT NULL DEFAULT 0;
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS bill_5 integer NOT NULL DEFAULT 0;
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS bill_2 integer NOT NULL DEFAULT 0;
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS bill_1 integer NOT NULL DEFAULT 0;
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS coin_25 integer NOT NULL DEFAULT 0;
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS coin_10 integer NOT NULL DEFAULT 0;
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS coin_5 integer NOT NULL DEFAULT 0;

-- Drop the old function signature first (required because we're adding new parameters)
DROP FUNCTION IF EXISTS public.create_cash_transaction_with_validation(uuid, date, text, numeric, text, text, uuid);

-- Recreate the function with denomination parameters
CREATE OR REPLACE FUNCTION public.create_cash_transaction_with_validation(
  p_store_id uuid,
  p_date date,
  p_transaction_type text,
  p_amount numeric,
  p_description text,
  p_category text,
  p_created_by_id uuid,
  p_bill_100 integer DEFAULT 0,
  p_bill_50 integer DEFAULT 0,
  p_bill_20 integer DEFAULT 0,
  p_bill_10 integer DEFAULT 0,
  p_bill_5 integer DEFAULT 0,
  p_bill_2 integer DEFAULT 0,
  p_bill_1 integer DEFAULT 0,
  p_coin_25 integer DEFAULT 0,
  p_coin_10 integer DEFAULT 0,
  p_coin_5 integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_access boolean;
  v_transaction_id uuid;
  v_employee_name text;
  v_store_name text;
BEGIN
  -- Validate employee has access to the store
  v_has_access := public.check_employee_store_access(p_created_by_id, p_store_id);

  IF NOT v_has_access THEN
    -- Get employee and store names for error message
    SELECT display_name INTO v_employee_name
    FROM public.employees
    WHERE id = p_created_by_id;

    SELECT name INTO v_store_name
    FROM public.stores
    WHERE id = p_store_id;

    -- Log the unauthorized attempt
    RAISE WARNING 'Unauthorized cross-store transaction attempt: Employee % (%) tried to create transaction for store % (%)',
      v_employee_name, p_created_by_id, v_store_name, p_store_id;

    RETURN json_build_object(
      'success', false,
      'error', 'Access denied: You do not have permission to create transactions for this store',
      'error_code', 'STORE_ACCESS_DENIED'
    );
  END IF;

  -- Create the transaction with denominations
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    amount,
    description,
    category,
    created_by_id,
    status,
    requires_manager_approval,
    created_at,
    bill_100,
    bill_50,
    bill_20,
    bill_10,
    bill_5,
    bill_2,
    bill_1,
    coin_25,
    coin_10,
    coin_5
  ) VALUES (
    p_store_id,
    p_date,
    p_transaction_type,
    p_amount,
    p_description,
    p_category,
    p_created_by_id,
    'pending_approval',
    true,
    now(),
    p_bill_100,
    p_bill_50,
    p_bill_20,
    p_bill_10,
    p_bill_5,
    p_bill_2,
    p_bill_1,
    p_coin_25,
    p_coin_10,
    p_coin_5
  )
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Update comment
COMMENT ON FUNCTION public.create_cash_transaction_with_validation IS
  'Secure transaction creation: Validates store access before creating cash transaction with denomination tracking';
