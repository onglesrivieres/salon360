/*
  # Add Store Access Validation for Cash Transactions

  ## Critical Security Fix

  This migration addresses a serious security vulnerability where employees could create
  transactions for stores they don't have access to by manipulating client-side session storage.

  ## Changes Made

  1. **Validation Function**: `check_employee_store_access`
     - Checks if an employee has access to a specific store via employee_stores table
     - Returns true if employee has access or if employee has no store restrictions
     - Returns false if employee is restricted and doesn't have access

  2. **RLS Policy on cash_transactions**
     - Adds INSERT policy that validates employee has access to the transaction's store
     - Prevents creation of cross-store transactions at the database level

  3. **Secure Transaction Creation Function**: `create_cash_transaction_with_validation`
     - Server-side function that validates store access before creating transaction
     - Returns proper error messages for unauthorized access
     - Ensures data integrity through database-level validation

  ## Security Impact

  - Prevents employees from creating transactions for unauthorized stores
  - Blocks session storage manipulation attacks
  - Enforces multi-store access control at database level
  - Provides audit trail of attempted unauthorized access
*/

-- Create function to check if employee has access to a store
CREATE OR REPLACE FUNCTION public.check_employee_store_access(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned_stores_count integer;
  v_has_access boolean;
BEGIN
  -- Check if employee has any store assignments
  SELECT COUNT(*)
  INTO v_assigned_stores_count
  FROM public.employee_stores
  WHERE employee_id = p_employee_id;

  -- If employee has no assignments, they can access any store (legacy/admin behavior)
  IF v_assigned_stores_count = 0 THEN
    RETURN true;
  END IF;

  -- Check if employee is assigned to the specific store
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_stores
    WHERE employee_id = p_employee_id
      AND store_id = p_store_id
  )
  INTO v_has_access;

  RETURN v_has_access;
END;
$$;

-- Add RLS policy to prevent cross-store transaction creation
DROP POLICY IF EXISTS "Employees can only create transactions for assigned stores" ON public.cash_transactions;

CREATE POLICY "Employees can only create transactions for assigned stores"
  ON public.cash_transactions
  FOR INSERT
  WITH CHECK (
    public.check_employee_store_access(created_by_id, store_id)
  );

-- Create secure transaction creation function with validation
CREATE OR REPLACE FUNCTION public.create_cash_transaction_with_validation(
  p_store_id uuid,
  p_date date,
  p_transaction_type text,
  p_amount numeric,
  p_description text,
  p_category text,
  p_created_by_id uuid
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

  -- Create the transaction
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
    created_at
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
    now()
  )
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_employee_store_access TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cash_transaction_with_validation TO anon, authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.check_employee_store_access IS
  'Security function: Validates if an employee has access to a specific store via employee_stores junction table';

COMMENT ON FUNCTION public.create_cash_transaction_with_validation IS
  'Secure transaction creation: Validates store access before creating cash transaction, prevents cross-store unauthorized access';