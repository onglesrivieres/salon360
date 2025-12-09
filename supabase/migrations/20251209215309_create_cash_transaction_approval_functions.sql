/*
  # Create Cash Transaction Approval Functions

  1. New Functions
    - `get_pending_cash_transaction_approvals` - Get pending cash transactions for managers/owners
      - Returns all pending cash transactions for a store
      - Includes employee names for creator and approver
      - Used by Pending Approvals page

  2. Security
    - Functions use SECURITY DEFINER with search_path set
    - RLS policies already in place on cash_transactions table
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.get_pending_cash_transaction_approvals(uuid);

-- Function to get pending cash transaction approvals
CREATE OR REPLACE FUNCTION public.get_pending_cash_transaction_approvals(
  p_store_id uuid
)
RETURNS TABLE (
  transaction_id uuid,
  transaction_type text,
  amount numeric,
  description text,
  category text,
  date date,
  created_by_name text,
  created_by_id uuid,
  created_at timestamptz,
  requires_manager_approval boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.id as transaction_id,
    ct.transaction_type,
    ct.amount,
    ct.description,
    ct.category,
    ct.date,
    COALESCE(e.display_name, e.legal_name, 'Unknown') as created_by_name,
    ct.created_by_id,
    ct.created_at,
    ct.requires_manager_approval
  FROM public.cash_transactions ct
  LEFT JOIN public.employees e ON ct.created_by_id = e.id
  WHERE ct.store_id = p_store_id
    AND ct.status = 'pending_approval'
  ORDER BY ct.created_at DESC;
END;
$$;
