-- Fix get_pending_distribution_approvals: ii.item_name -> ii.name
-- The inventory_items table column is "name", not "item_name".
-- This caused a 400 error (42703) on the Approvals Inventory tab.

CREATE OR REPLACE FUNCTION public.get_pending_distribution_approvals(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS TABLE (
  batch_id uuid,
  item_id uuid,
  item_name text,
  to_employee_id uuid,
  to_employee_name text,
  distributed_by_id uuid,
  distributed_by_name text,
  distributed_by_role text,
  total_quantity numeric,
  total_value numeric,
  distribution_count bigint,
  distribution_date timestamptz,
  condition_notes text,
  status text,
  manager_approved boolean,
  approval_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_viewer_role text;
BEGIN
  -- Look up the viewer's highest role
  SELECT CASE
    WHEN 'Admin' = ANY(e.role) THEN 'Admin'
    WHEN 'Owner' = ANY(e.role) THEN 'Owner'
    WHEN 'Manager' = ANY(e.role) THEN 'Manager'
    WHEN 'Supervisor' = ANY(e.role) THEN 'Supervisor'
    WHEN 'Receptionist' = ANY(e.role) THEN 'Receptionist'
    WHEN 'Cashier' = ANY(e.role) THEN 'Cashier'
    WHEN 'Technician' = ANY(e.role) THEN 'Technician'
    WHEN 'Trainee' = ANY(e.role) THEN 'Trainee'
    ELSE 'Technician'
  END INTO v_viewer_role
  FROM public.employees e
  WHERE e.id = p_employee_id;

  -- Employee acknowledgment: distributions where I am the recipient and status = 'pending'
  RETURN QUERY
  SELECT
    d.distribution_batch_id AS batch_id,
    d.item_id,
    COALESCE(ii.name, 'Unknown Item') AS item_name,
    d.to_employee_id,
    COALESCE(te.display_name, te.legal_name, 'Unknown') AS to_employee_name,
    d.distributed_by_id,
    COALESCE(de.display_name, de.legal_name, 'Unknown') AS distributed_by_name,
    d.distributed_by_role,
    SUM(d.quantity) AS total_quantity,
    SUM(d.quantity * d.unit_cost) AS total_value,
    COUNT(*)::bigint AS distribution_count,
    MIN(d.distribution_date) AS distribution_date,
    MAX(d.condition_notes) AS condition_notes,
    MIN(d.status) AS status,
    bool_and(d.manager_approved) AS manager_approved,
    'acknowledge'::text AS approval_type
  FROM public.inventory_distributions d
  LEFT JOIN public.inventory_items ii ON ii.id = d.item_id
  LEFT JOIN public.employees te ON te.id = d.to_employee_id
  LEFT JOIN public.employees de ON de.id = d.distributed_by_id
  WHERE d.store_id = p_store_id
    AND d.to_employee_id = p_employee_id
    AND d.status = 'pending'
    AND d.distribution_batch_id IS NOT NULL
  GROUP BY d.distribution_batch_id, d.item_id, ii.name, d.to_employee_id, te.display_name, te.legal_name,
           d.distributed_by_id, de.display_name, de.legal_name, d.distributed_by_role

  UNION ALL

  -- Manager approval: distributions not yet manager-approved, where viewer outranks creator
  SELECT
    d.distribution_batch_id AS batch_id,
    d.item_id,
    COALESCE(ii.name, 'Unknown Item') AS item_name,
    d.to_employee_id,
    COALESCE(te.display_name, te.legal_name, 'Unknown') AS to_employee_name,
    d.distributed_by_id,
    COALESCE(de.display_name, de.legal_name, 'Unknown') AS distributed_by_name,
    d.distributed_by_role,
    SUM(d.quantity) AS total_quantity,
    SUM(d.quantity * d.unit_cost) AS total_value,
    COUNT(*)::bigint AS distribution_count,
    MIN(d.distribution_date) AS distribution_date,
    MAX(d.condition_notes) AS condition_notes,
    MIN(d.status) AS status,
    bool_and(d.manager_approved) AS manager_approved,
    'manager_approve'::text AS approval_type
  FROM public.inventory_distributions d
  LEFT JOIN public.inventory_items ii ON ii.id = d.item_id
  LEFT JOIN public.employees te ON te.id = d.to_employee_id
  LEFT JOIN public.employees de ON de.id = d.distributed_by_id
  WHERE d.store_id = p_store_id
    AND d.manager_approved = false
    AND d.distributed_by_id != p_employee_id  -- self-approval blocked
    AND d.distribution_batch_id IS NOT NULL
    -- Viewer must outrank creator
    AND CASE
      WHEN d.distributed_by_role = 'Owner' THEN v_viewer_role IN ('Admin')
      WHEN d.distributed_by_role = 'Manager' THEN v_viewer_role IN ('Admin', 'Owner')
      WHEN d.distributed_by_role = 'Supervisor' THEN v_viewer_role IN ('Admin', 'Owner', 'Manager')
      WHEN d.distributed_by_role IN ('Receptionist', 'Cashier', 'Technician', 'Trainee') THEN v_viewer_role IN ('Admin', 'Owner', 'Manager', 'Supervisor')
      ELSE false
    END
  GROUP BY d.distribution_batch_id, d.item_id, ii.name, d.to_employee_id, te.display_name, te.legal_name,
           d.distributed_by_id, de.display_name, de.legal_name, d.distributed_by_role;

  RETURN;
END;
$function$;
