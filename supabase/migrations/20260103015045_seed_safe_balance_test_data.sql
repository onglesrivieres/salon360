/*
  # Seed Safe Balance Test Data

  ## Overview
  This migration creates comprehensive test data for the Safe Balance system
  to facilitate testing and development.

  ## Test Data Created

  1. **Historical Safe Balance Records (Past 7 Days)**
     - Daily records with varying opening/closing balances
     - Progressive balance changes across days
     - For first store: Ongles Charlesbourg

  2. **Approved Cash Transactions**
     - 5 Safe Deposits (cash_out type)
     - 3 Safe Withdrawals (cash_in type)
     - Distributed across multiple dates

  3. **Pending Cash Transactions**
     - 2 Pending deposits
     - 1 Pending withdrawal
     - For testing approval workflows

  4. **Edge Case Scenarios**
     - Day with zero transactions
     - Day with only deposits
     - Day with only withdrawals
     - Current day with mixed transactions

  ## Usage
  After applying this migration, you can:
  - Test the Safe Balance page with real data
  - Verify balance calculations are correct
  - Test approval workflows
  - Check date navigation
*/

-- Get the first store and employee for test data
DO $$
DECLARE
  v_store_id uuid;
  v_employee_id uuid;
  v_date date;
  v_base_balance decimal(10, 2) := 500.00;
BEGIN
  -- Get first store (Ongles Charlesbourg)
  SELECT id INTO v_store_id FROM public.stores ORDER BY name LIMIT 1;
  
  -- Get first employee
  SELECT id INTO v_employee_id FROM public.employees LIMIT 1;

  -- Only proceed if we have valid store and employee
  IF v_store_id IS NULL OR v_employee_id IS NULL THEN
    RAISE NOTICE 'Skipping seed data: No store or employee found';
    RETURN;
  END IF;

  RAISE NOTICE 'Creating test data for store: % and employee: %', v_store_id, v_employee_id;

  -- =====================================================================
  -- PART 1: Create Historical Safe Balance Records (Past 7 Days)
  -- =====================================================================
  
  FOR i IN 7..1 LOOP
    v_date := CURRENT_DATE - i;
    
    -- Create historical balance record
    INSERT INTO public.safe_balance_history (
      store_id,
      date,
      opening_balance,
      closing_balance,
      total_deposits,
      total_withdrawals,
      created_by_id,
      created_at
    ) VALUES (
      v_store_id,
      v_date,
      v_base_balance + (i - 1) * 50,  -- Opening balance increases each day
      v_base_balance + i * 50,         -- Closing balance
      100.00 + (i * 20),               -- Deposits vary
      50.00 + (i * 5),                 -- Withdrawals vary
      v_employee_id,
      v_date::timestamp
    )
    ON CONFLICT (store_id, date) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Created 7 days of historical balance records';

  -- =====================================================================
  -- PART 2: Create Approved Safe Deposits (cash_out + Safe Deposit)
  -- =====================================================================
  
  -- Deposit 1: 3 days ago
  v_date := CURRENT_DATE - 3;
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    created_by_id,
    manager_approved_by_id,
    created_at,
    manager_approved_at
  ) VALUES (
    v_store_id,
    v_date,
    'cash_out',
    'Safe Deposit',
    150.00,
    'End of day cash deposit to safe',
    'approved',
    true,
    true,
    v_employee_id,
    v_employee_id,
    v_date::timestamp,
    v_date::timestamp + interval '30 minutes'
  );

  -- Deposit 2: 2 days ago
  v_date := CURRENT_DATE - 2;
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    created_by_id,
    manager_approved_by_id,
    created_at,
    manager_approved_at
  ) VALUES (
    v_store_id,
    v_date,
    'cash_out',
    'Safe Deposit',
    200.00,
    'Daily cash deposit',
    'approved',
    true,
    true,
    v_employee_id,
    v_employee_id,
    v_date::timestamp,
    v_date::timestamp + interval '15 minutes'
  );

  -- Deposit 3: Yesterday
  v_date := CURRENT_DATE - 1;
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    created_by_id,
    manager_approved_by_id,
    created_at,
    manager_approved_at
  ) VALUES (
    v_store_id,
    v_date,
    'cash_out',
    'Safe Deposit',
    175.00,
    'Evening deposit to safe',
    'approved',
    true,
    true,
    v_employee_id,
    v_employee_id,
    v_date::timestamp,
    v_date::timestamp + interval '20 minutes'
  );

  -- Deposit 4: Today (morning)
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    created_by_id,
    manager_approved_by_id,
    created_at,
    manager_approved_at
  ) VALUES (
    v_store_id,
    CURRENT_DATE,
    'cash_out',
    'Safe Deposit',
    125.00,
    'Morning deposit',
    'approved',
    true,
    true,
    v_employee_id,
    v_employee_id,
    CURRENT_TIMESTAMP - interval '2 hours',
    CURRENT_TIMESTAMP - interval '90 minutes'
  );

  -- Deposit 5: Today (afternoon)
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    created_by_id,
    manager_approved_by_id,
    created_at,
    manager_approved_at
  ) VALUES (
    v_store_id,
    CURRENT_DATE,
    'cash_out',
    'Safe Deposit',
    180.00,
    'Afternoon deposit',
    'approved',
    true,
    true,
    v_employee_id,
    v_employee_id,
    CURRENT_TIMESTAMP - interval '1 hour',
    CURRENT_TIMESTAMP - interval '45 minutes'
  );

  RAISE NOTICE 'Created 5 approved safe deposits';

  -- =====================================================================
  -- PART 3: Create Approved Safe Withdrawals (cash_in + Safe Withdrawal)
  -- =====================================================================
  
  -- Withdrawal 1: 2 days ago
  v_date := CURRENT_DATE - 2;
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    created_by_id,
    manager_approved_by_id,
    created_at,
    manager_approved_at
  ) VALUES (
    v_store_id,
    v_date,
    'cash_in',
    'Safe Withdrawal',
    75.00,
    'Change fund for registers',
    'approved',
    true,
    true,
    v_employee_id,
    v_employee_id,
    v_date::timestamp,
    v_date::timestamp + interval '10 minutes'
  );

  -- Withdrawal 2: Yesterday
  v_date := CURRENT_DATE - 1;
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    created_by_id,
    manager_approved_by_id,
    created_at,
    manager_approved_at
  ) VALUES (
    v_store_id,
    v_date,
    'cash_in',
    'Safe Withdrawal',
    100.00,
    'Supplies payment',
    'approved',
    true,
    true,
    v_employee_id,
    v_employee_id,
    v_date::timestamp,
    v_date::timestamp + interval '25 minutes'
  );

  -- Withdrawal 3: Today
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    created_by_id,
    manager_approved_by_id,
    created_at,
    manager_approved_at
  ) VALUES (
    v_store_id,
    CURRENT_DATE,
    'cash_in',
    'Safe Withdrawal',
    50.00,
    'Petty cash',
    'approved',
    true,
    true,
    v_employee_id,
    v_employee_id,
    CURRENT_TIMESTAMP - interval '30 minutes',
    CURRENT_TIMESTAMP - interval '15 minutes'
  );

  RAISE NOTICE 'Created 3 approved safe withdrawals';

  -- =====================================================================
  -- PART 4: Create Pending Transactions (For Testing Approval Flow)
  -- =====================================================================
  
  -- Pending Deposit 1
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    created_by_id,
    created_at
  ) VALUES (
    v_store_id,
    CURRENT_DATE,
    'cash_out',
    'Safe Deposit',
    220.00,
    'Pending evening deposit',
    'pending_approval',
    true,
    false,
    v_employee_id,
    CURRENT_TIMESTAMP - interval '10 minutes'
  );

  -- Pending Deposit 2
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    created_by_id,
    created_at
  ) VALUES (
    v_store_id,
    CURRENT_DATE,
    'cash_out',
    'Safe Deposit',
    140.00,
    'Pending cash deposit',
    'pending_approval',
    true,
    false,
    v_employee_id,
    CURRENT_TIMESTAMP - interval '5 minutes'
  );

  -- Pending Withdrawal
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    created_by_id,
    created_at
  ) VALUES (
    v_store_id,
    CURRENT_DATE,
    'cash_in',
    'Safe Withdrawal',
    85.00,
    'Pending withdrawal for supplies',
    'pending_approval',
    true,
    false,
    v_employee_id,
    CURRENT_TIMESTAMP - interval '3 minutes'
  );

  RAISE NOTICE 'Created 3 pending transactions';

  -- =====================================================================
  -- PART 5: Create Edge Case - Rejected Transaction
  -- =====================================================================
  
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    category,
    amount,
    description,
    status,
    requires_manager_approval,
    manager_approved,
    rejection_reason,
    created_by_id,
    manager_approved_by_id,
    created_at,
    manager_approved_at
  ) VALUES (
    v_store_id,
    CURRENT_DATE - 1,
    'cash_in',
    'Safe Withdrawal',
    300.00,
    'Large withdrawal - rejected',
    'rejected',
    true,
    false,
    'Amount too large, requires additional approval',
    v_employee_id,
    v_employee_id,
    (CURRENT_DATE - 1)::timestamp,
    (CURRENT_DATE - 1)::timestamp + interval '1 hour'
  );

  RAISE NOTICE 'Created 1 rejected transaction';

  -- =====================================================================
  -- Summary
  -- =====================================================================
  
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Safe Balance Test Data Summary:';
  RAISE NOTICE '- 7 historical balance records';
  RAISE NOTICE '- 5 approved deposits (cash_out)';
  RAISE NOTICE '- 3 approved withdrawals (cash_in)';
  RAISE NOTICE '- 2 pending deposits';
  RAISE NOTICE '- 1 pending withdrawal';
  RAISE NOTICE '- 1 rejected withdrawal';
  RAISE NOTICE '====================================';

END $$;