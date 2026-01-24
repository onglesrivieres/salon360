/*
  # Create Headquarter Deposit Auto-Transfer Trigger

  1. Purpose
    - When a store creates a Safe Withdrawal with category 'Headquarter Deposit'
    - Automatically create a corresponding Safe Deposit in the headquarters store
    - The deposit description shows the source store name

  2. Behavior
    - Triggers AFTER INSERT on cash_transactions
    - Only fires for: transaction_type = 'cash_payout' AND category = 'Headquarter Deposit'
    - Creates a new transaction in HQ store with:
      - transaction_type = 'cash_out' (Safe Deposit type)
      - category = 'Safe Deposit'
      - status = 'approved' (auto-approved)
      - Same amount, date, and created_by employee

  3. Notes
    - Does NOT create deposit if source store IS the headquarters (prevent self-deposit)
    - Includes source store name in description for tracking
*/

-- Create trigger function for headquarter deposit auto-transfer
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
    'cash_out',  -- Safe Deposit transaction type
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_headquarter_deposit_transfer ON public.cash_transactions;

-- Create trigger that fires after insert
CREATE TRIGGER trigger_headquarter_deposit_transfer
  AFTER INSERT ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_headquarter_deposit_transfer();

-- Add comment to document the trigger
COMMENT ON FUNCTION public.create_headquarter_deposit_transfer() IS
'Automatically creates a Safe Deposit in headquarters when a Headquarter Deposit withdrawal is created at any other store.';
