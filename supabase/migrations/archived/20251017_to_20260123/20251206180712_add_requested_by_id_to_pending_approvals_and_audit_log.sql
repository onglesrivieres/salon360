/*
  # Add Self-Approval Prevention and Audit Logging

  1. Changes
    - Update get_pending_inventory_approvals function to return requested_by_id
    - Create inventory_approval_audit_log table for tracking self-approval attempts
    - Add RLS policies for audit log

  2. Security
    - Enable RLS on audit log table
    - Allow all authenticated users to insert audit records
    - Only managers can read audit records

  3. Notes
    - This ensures separation of duties in inventory approval process
    - All self-approval attempts are logged for compliance
*/

-- Drop existing function to recreate with requested_by_id
DROP FUNCTION IF EXISTS public.get_pending_inventory_approvals(uuid, uuid);

-- Recreate function with requested_by_id in return type
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
  GROUP BY it.id, it.transaction_number, it.transaction_type, it.requested_by_id, req.display_name, rec.display_name,
           it.notes, it.status, it.requires_recipient_approval, it.requires_manager_approval,
           it.recipient_approved, it.manager_approved, it.created_at
  ORDER BY it.created_at DESC;
END;
$$;

-- Create audit log table for self-approval attempts
CREATE TABLE IF NOT EXISTS public.inventory_approval_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.inventory_transactions(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  action_attempted text NOT NULL CHECK (action_attempted IN ('approve', 'reject')),
  transaction_type text NOT NULL CHECK (transaction_type IN ('in', 'out')),
  transaction_number text NOT NULL,
  blocked_reason text NOT NULL DEFAULT 'Self-approval not allowed',
  created_at timestamptz DEFAULT now()
);

-- Create index for audit log queries
CREATE INDEX IF NOT EXISTS idx_inventory_audit_log_employee ON public.inventory_approval_audit_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_log_transaction ON public.inventory_approval_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_log_created_at ON public.inventory_approval_audit_log(created_at DESC);

-- Enable RLS on audit log
ALTER TABLE public.inventory_approval_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to insert audit records (for logging)
CREATE POLICY "Authenticated users can insert audit records"
  ON public.inventory_approval_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
  );

-- Only managers and owners can read audit records
CREATE POLICY "Managers can view audit records"
  ON public.inventory_approval_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
      AND ('Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
    )
  );
