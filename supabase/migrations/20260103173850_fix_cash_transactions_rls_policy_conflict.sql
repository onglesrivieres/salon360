/*
  # Fix Cash Transactions RLS Policy Conflict

  ## Issue
  There are two conflicting INSERT policies on cash_transactions:
  1. "Allow insert cash transactions" - allows all inserts (permissive)
  2. "Employees can only create transactions for assigned stores" - validates store access

  The old permissive policy is overriding our security policy.

  ## Fix
  Drop the old permissive policy so only the secure validation policy applies.

  ## Security Impact
  - Removes the bypass that was allowing direct inserts without validation
  - Ensures all transaction creation goes through store access validation
  - Completes the security fix for cross-store transaction prevention
*/

-- Drop the old permissive policy that was allowing everything
DROP POLICY IF EXISTS "Allow insert cash transactions" ON public.cash_transactions;

-- Verify our secure policy is in place (it should be from the previous migration)
-- If for some reason it's not, recreate it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cash_transactions'
      AND policyname = 'Employees can only create transactions for assigned stores'
  ) THEN
    CREATE POLICY "Employees can only create transactions for assigned stores"
      ON public.cash_transactions
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (
        public.check_employee_store_access(created_by_id, store_id)
      );
  END IF;
END $$;

-- Update the existing policy to apply to anon and authenticated roles (not just public)
DROP POLICY IF EXISTS "Employees can only create transactions for assigned stores" ON public.cash_transactions;

CREATE POLICY "Employees can only create transactions for assigned stores"
  ON public.cash_transactions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public.check_employee_store_access(created_by_id, store_id)
  );
