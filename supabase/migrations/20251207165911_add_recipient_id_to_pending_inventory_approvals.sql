/*
  # Fix Inventory Transaction Approval - Add recipient_id

  1. Changes
    - Update get_pending_inventory_approvals function to return recipient_id
    - This allows the frontend to correctly identify if current user is the recipient

  2. Issue Fixed
    - Frontend was comparing employee_id with transaction id instead of recipient_id
    - This prevented recipient approvals from working correctly
    - Now recipient_id is available for proper comparison

  3. Impact
    - Managers can approve transactions requiring manager approval
    - Recipients can approve OUT transactions requiring recipient approval
    - Auto-approval trigger works correctly when all required approvals received
*/

-- Drop existing function to recreate with recipient_id
DROP FUNCTION IF EXISTS public.get_pending_inventory_approvals(uuid, uuid);

-- Recreate function with recipient_id in return type
CREATE OR REPLACE FUNCTION public.get_pending_inventory_approvals(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS TABLE (
  id uuid,
  transaction_number text,
  transaction_type text,
  requested_by_id uuid,
  requested_by_name text,
  recipient_id uuid,
  recipient_name text,
  notes text,
  status text,
  requires_recipient_approval boolean,
  requires_manager_approval boolean,
  recipient_approved boolean,
  manager_approved boolean,
  created_at timestamptz,
  item_count bigint,
  total_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_roles text[];
  v_is_manager boolean;
BEGIN
  SELECT e.role INTO v_employee_roles
  FROM public.employees e
  WHERE e.id = p_employee_id;

  v_is_manager := 'Manager' = ANY(v_employee_roles) OR 'Owner' = ANY(v_employee_roles);

  RETURN QUERY
  SELECT
    it.id,
    it.transaction_number,
    it.transaction_type,
    it.requested_by_id,
    req.display_name as requested_by_name,
    it.recipient_id,
    COALESCE(rec.display_name, '') as recipient_name,
    it.notes,
    it.status,
    it.requires_recipient_approval,
    it.requires_manager_approval,
    it.recipient_approved,
    it.manager_approved,
    it.created_at,
    COUNT(iti.id) as item_count,
    SUM(iti.quantity * iti.unit_cost) as total_value
  FROM public.inventory_transactions it
  JOIN public.employees req ON req.id = it.requested_by_id
  LEFT JOIN public.employees rec ON rec.id = it.recipient_id
  LEFT JOIN public.inventory_transaction_items iti ON iti.transaction_id = it.id
  WHERE it.store_id = p_store_id
    AND it.status = 'pending'
    AND (
      (v_is_manager AND it.requires_manager_approval AND NOT it.manager_approved)
      OR
      (it.recipient_id = p_employee_id AND it.requires_recipient_approval AND NOT it.recipient_approved)
    )
  GROUP BY it.id, it.transaction_number, it.transaction_type, it.requested_by_id, req.display_name,
           it.recipient_id, rec.display_name, it.notes, it.status, it.requires_recipient_approval,
           it.requires_manager_approval, it.recipient_approved, it.manager_approved, it.created_at
  ORDER BY it.created_at DESC;
END;
$$;