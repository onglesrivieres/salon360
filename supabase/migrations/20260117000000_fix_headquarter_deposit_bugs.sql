/*
  # Fix Headquarter Deposit Bugs

  1. Bug 1: HQ deposits showing in End of Day page
    - Problem: Trigger creates transactions with 'cash_out' type, which EOD displays
    - Fix: Change to new 'hq_deposit' transaction type that EOD won't query

  2. Bug 2: Branch safe balance not reduced after HQ withdrawal
    - Problem: get_safe_balance_for_date excludes 'Headquarter Deposit' from withdrawals
    - Fix: Add 'Headquarter Deposit' to the withdrawal categories

  3. Data Fix: Update existing HQ deposit transactions to use new type
*/

-- ============================================
-- Step 1: Update the trigger function
-- Change transaction_type from 'cash_out' to 'hq_deposit'
-- ============================================

CREATE OR REPLACE FUNCTION public.create_headquarter_deposit_transfer()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_hq_store_id uuid;
  v_source_store_name text;
BEGIN
  -- Only process Headquarter Deposit withdrawals
  IF NEW.transaction_type != 'cash_payout' OR NEW.category != 'Headquarter Deposit' THEN
    RETURN NEW;
  END IF;

  -- Get the headquarters store ID
  SELECT id INTO v_hq_store_id
  FROM public.stores
  WHERE is_headquarters = true
  LIMIT 1;

  -- If no headquarters store found, skip
  IF v_hq_store_id IS NULL THEN
    RAISE WARNING 'No headquarters store found. Skipping auto-deposit creation.';
    RETURN NEW;
  END IF;

  -- Don't create deposit if source store IS the headquarters
  IF NEW.store_id = v_hq_store_id THEN
    RETURN NEW;
  END IF;

  -- Get the source store name for the description
  SELECT name INTO v_source_store_name
  FROM public.stores
  WHERE id = NEW.store_id;

  -- Create the deposit transaction in headquarters
  -- Using 'hq_deposit' type so it skips EOD and goes directly to Safe Balance
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
    manager_approved,
    manager_approved_by_id,
    manager_approved_at
  ) VALUES (
    v_hq_store_id,
    NEW.date,
    'hq_deposit',  -- Changed from 'cash_out' to skip EOD page
    NEW.amount,
    'HQ Deposit from ' || COALESCE(v_source_store_name, 'Unknown Store'),
    'Safe Deposit',
    NEW.created_by_id,
    'approved',  -- Auto-approved
    false,       -- No manager approval required
    true,        -- Already approved
    NEW.created_by_id,  -- Same employee as approver
    now()
  );

  RETURN NEW;
END;
$$;

-- Update function comment
COMMENT ON FUNCTION public.create_headquarter_deposit_transfer() IS
'Automatically creates a Safe Deposit in headquarters when a Headquarter Deposit withdrawal is created at any other store.
Uses hq_deposit transaction type to skip EOD page and go directly to Safe Balance.';


-- ============================================
-- Step 2: Update safe balance function
-- Add 'Headquarter Deposit' to withdrawal categories
-- Add 'hq_deposit' to deposit types
-- ============================================

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
  -- Withdrawals are: transaction_type = 'cash_payout' AND category IN ('Payroll', 'Tip Payout', 'Headquarter Deposit')
  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_payout'
    AND category IN ('Payroll', 'Tip Payout', 'Headquarter Deposit')
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
Withdrawals: cash_payout + Payroll/Tip Payout/Headquarter Deposit categories
Formula: closing_balance = opening_balance + deposits - withdrawals';


-- ============================================
-- Step 3: Fix existing data
-- Update existing HQ deposit transactions from 'cash_out' to 'hq_deposit'
-- ============================================

UPDATE public.cash_transactions
SET transaction_type = 'hq_deposit'
WHERE transaction_type = 'cash_out'
  AND category = 'Safe Deposit'
  AND description LIKE 'HQ Deposit from%';
