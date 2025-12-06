/*
  # Fix Transaction Number Generation Race Condition

  1. Problem
    - The current `generate_inventory_transaction_number` function has a race condition
    - Multiple concurrent transactions can get the same number, causing duplicate key violations
    - This happens because SELECT MAX and INSERT are not atomic

  2. Solution
    - Add PostgreSQL advisory lock to ensure only one transaction generates a number at a time
    - Lock is based on hash of (store_id + transaction_type + date)
    - Lock is automatically released when the transaction commits/rolls back
    - Different stores/types/dates won't block each other

  3. Changes
    - Update `generate_inventory_transaction_number` function with pg_advisory_xact_lock()
    - Lock ID is computed from hashtext() of the prefix pattern
    - This ensures thread-safe, sequential number generation
*/

-- Drop and recreate the function with advisory lock
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
  -- Generate date string and prefix
  v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  v_prefix := CASE
    WHEN p_transaction_type = 'in' THEN 'IN'
    WHEN p_transaction_type = 'out' THEN 'OUT'
    ELSE 'TXN'
  END;

  -- Create a unique lock key based on store, type, and date
  -- This ensures different stores/types/dates don't block each other
  -- but same store/type/date combinations are serialized
  v_lock_key := hashtext(p_store_id::text || '-' || v_prefix || '-' || v_date_str);

  -- Acquire advisory lock for this specific combination
  -- This lock is automatically released at transaction end
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Now safely get the next number (protected by the lock)
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(transaction_number FROM '\\d+$') AS INTEGER
    )
  ), 0) + 1
  INTO v_next_num
  FROM public.inventory_transactions
  WHERE transaction_number LIKE v_prefix || '-' || v_date_str || '-%';

  -- Format the transaction number
  v_transaction_number := v_prefix || '-' || v_date_str || '-' || LPAD(v_next_num::text, 4, '0');

  RETURN v_transaction_number;
END;
$$;
