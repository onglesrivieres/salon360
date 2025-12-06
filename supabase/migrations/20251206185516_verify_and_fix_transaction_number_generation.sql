/*
  # Verify and Fix Transaction Number Generation Race Condition

  1. Problem
    - Duplicate key violations on unique_transaction_number constraint
    - Race condition when multiple concurrent transaction creations occur
    - The advisory lock fix may not have been applied properly

  2. Solution
    - Drop and recreate the function with proper advisory locking
    - Use pg_advisory_xact_lock() to serialize number generation
    - Lock scope is per store/type/date combination to minimize blocking

  3. How Advisory Locks Work
    - pg_advisory_xact_lock() acquires a transaction-level advisory lock
    - Lock is automatically released when the transaction commits or rolls back
    - Different store/type/date combinations use different lock IDs
    - Only concurrent requests for the same combination will wait

  4. Testing
    - Concurrent requests for same store/type/date will be serialized
    - Different stores/types/dates won't block each other
    - Ensures unique sequential numbering within each category
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS public.generate_inventory_transaction_number(text, uuid);

-- Recreate with proper advisory locking
CREATE OR REPLACE FUNCTION public.generate_inventory_transaction_number(
  p_transaction_type text,
  p_store_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_str text;
  v_prefix text;
  v_next_num integer;
  v_transaction_number text;
  v_lock_key bigint;
BEGIN
  -- Generate date string (YYYYMMDD format)
  v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Determine prefix based on transaction type
  v_prefix := CASE
    WHEN p_transaction_type = 'in' THEN 'IN'
    WHEN p_transaction_type = 'out' THEN 'OUT'
    ELSE 'TXN'
  END;

  -- Create a unique lock key based on store, type, and date
  -- This ensures that:
  -- 1. Different stores don't block each other
  -- 2. Different transaction types don't block each other
  -- 3. Different dates don't block each other
  -- 4. Same store/type/date combinations ARE serialized
  v_lock_key := hashtext(p_store_id::text || '-' || v_prefix || '-' || v_date_str);

  -- Acquire advisory lock for this specific combination
  -- This lock is automatically released at transaction end (commit or rollback)
  -- Multiple concurrent requests with the same lock key will wait in line
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Now safely get the next number (protected by the advisory lock)
  -- No other transaction can execute this SELECT while we hold the lock
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(transaction_number FROM '\\d+$') AS INTEGER
    )
  ), 0) + 1
  INTO v_next_num
  FROM public.inventory_transactions
  WHERE transaction_number LIKE v_prefix || '-' || v_date_str || '-%'
    AND store_id = p_store_id;

  -- Format the transaction number with zero-padded 4-digit sequence
  -- Example: IN-20241206-0001, OUT-20241206-0042
  v_transaction_number := v_prefix || '-' || v_date_str || '-' || LPAD(v_next_num::text, 4, '0');

  RETURN v_transaction_number;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION public.generate_inventory_transaction_number(text, uuid) IS
  'Generates unique transaction numbers with advisory lock protection.
   Format: {PREFIX}-{YYYYMMDD}-{NNNN}
   Uses pg_advisory_xact_lock() to prevent race conditions.
   Lock scope: per store, per type, per date.';

-- Verify the function exists and has the correct signature
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'generate_inventory_transaction_number'
    AND pg_get_function_arguments(p.oid) = 'p_transaction_type text, p_store_id uuid'
  ) THEN
    RAISE EXCEPTION 'Function generate_inventory_transaction_number was not created successfully';
  END IF;

  RAISE NOTICE 'Transaction number generation function verified successfully';
END $$;
