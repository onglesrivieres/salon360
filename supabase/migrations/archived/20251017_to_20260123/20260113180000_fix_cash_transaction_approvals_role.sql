/*
  # Fix get_pending_cash_transaction_approvals function

  The role_permission column was removed from employees table.
  This function needs to compute the role from the role[] array instead.
*/

DROP FUNCTION IF EXISTS public.get_pending_cash_transaction_approvals(uuid);

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
  created_by_role text,
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
    -- Compute role_permission from role array (same logic as frontend)
    CASE
      WHEN 'Admin' = ANY(e.role) OR 'Manager' = ANY(e.role) OR 'Owner' = ANY(e.role) THEN 'Admin'
      WHEN 'Supervisor' = ANY(e.role) THEN 'Supervisor'
      WHEN 'Receptionist' = ANY(e.role) THEN 'Receptionist'
      WHEN 'Cashier' = ANY(e.role) THEN 'Cashier'
      ELSE 'Technician'
    END as created_by_role,
    ct.created_at,
    ct.requires_manager_approval
  FROM public.cash_transactions ct
  LEFT JOIN public.employees e ON ct.created_by_id = e.id
  WHERE ct.store_id = p_store_id
    AND ct.status = 'pending_approval'
  ORDER BY ct.created_at DESC;
END;
$$;
