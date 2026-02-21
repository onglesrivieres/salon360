-- Distribution Reject & View
-- Adds reject capability (with stock reversal) and batch detail view for distribution approvals.

-- 1. Schema changes: rejection columns on inventory_distributions
ALTER TABLE public.inventory_distributions
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS rejected_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- 2. Update status CHECK constraint to include 'rejected'
-- Drop old constraint, add new one
ALTER TABLE public.inventory_distributions
  DROP CONSTRAINT IF EXISTS inventory_distributions_status_check;

ALTER TABLE public.inventory_distributions
  ADD CONSTRAINT inventory_distributions_status_check
  CHECK (status IN ('pending', 'acknowledged', 'in_use', 'returned', 'consumed', 'cancelled', 'rejected'));

-- 3. reject_distribution RPC — reverses stock movements for a distribution batch
CREATE OR REPLACE FUNCTION public.reject_distribution(
  p_batch_id uuid,
  p_employee_id uuid,
  p_rejection_reason text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_creator_id uuid;
  v_creator_role text;
  v_rejector_role text;
  v_outranks boolean;
  v_row record;
  v_reversed_count integer := 0;
  v_skipped_count integer := 0;
  v_store_id uuid;
  v_item_id uuid;
  v_to_employee_id uuid;
  v_total_qty numeric := 0;
  v_total_value numeric := 0;
BEGIN
  -- Get batch info
  SELECT distributed_by_id, distributed_by_role, d.store_id, d.item_id, d.to_employee_id
  INTO v_creator_id, v_creator_role, v_store_id, v_item_id, v_to_employee_id
  FROM public.inventory_distributions d
  WHERE d.distribution_batch_id = p_batch_id
    AND d.status NOT IN ('rejected', 'cancelled')
  LIMIT 1;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'No active distributions found for this batch';
  END IF;

  -- Block self-rejection
  IF v_creator_id = p_employee_id THEN
    RAISE EXCEPTION 'Cannot reject your own distribution';
  END IF;

  -- Look up rejector's highest role
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
  END INTO v_rejector_role
  FROM public.employees e
  WHERE e.id = p_employee_id;

  -- Hierarchy check: rejector must outrank creator
  v_outranks := CASE
    WHEN v_creator_role = 'Owner' THEN v_rejector_role IN ('Admin')
    WHEN v_creator_role = 'Manager' THEN v_rejector_role IN ('Admin', 'Owner')
    WHEN v_creator_role = 'Supervisor' THEN v_rejector_role IN ('Admin', 'Owner', 'Manager')
    WHEN v_creator_role IN ('Receptionist', 'Cashier', 'Technician', 'Trainee') THEN v_rejector_role IN ('Admin', 'Owner', 'Manager', 'Supervisor')
    ELSE false
  END;

  IF NOT v_outranks THEN
    RAISE EXCEPTION 'Insufficient role to reject this distribution';
  END IF;

  -- Reverse stock for each eligible row (only pending/acknowledged can be reversed)
  FOR v_row IN
    SELECT id, lot_id, quantity, unit_cost, status
    FROM public.inventory_distributions
    WHERE distribution_batch_id = p_batch_id
      AND status NOT IN ('rejected', 'cancelled')
    ORDER BY created_at
  LOOP
    -- Only reverse rows that haven't progressed past acknowledgment
    IF v_row.status IN ('pending', 'acknowledged') THEN
      -- Return quantity to lot
      UPDATE public.inventory_purchase_lots
      SET quantity_remaining = quantity_remaining + v_row.quantity,
          status = 'active',
          updated_at = NOW()
      WHERE id = v_row.lot_id;

      -- Remove employee_inventory_lots entry
      DELETE FROM public.employee_inventory_lots
      WHERE employee_id = v_to_employee_id
        AND lot_id = v_row.lot_id
        AND item_id = v_item_id
        AND quantity = v_row.quantity;

      v_total_qty := v_total_qty + v_row.quantity;
      v_total_value := v_total_value + (v_row.quantity * v_row.unit_cost);
      v_reversed_count := v_reversed_count + 1;
    ELSE
      -- in_use, returned, consumed — skip reversal but still mark rejected
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  -- Deduct from employee_inventory (only reversed quantity)
  IF v_total_qty > 0 THEN
    UPDATE public.employee_inventory
    SET quantity_on_hand = GREATEST(0, quantity_on_hand - v_total_qty),
        total_value = GREATEST(0, total_value - v_total_value),
        updated_at = NOW()
    WHERE employee_id = v_to_employee_id
      AND item_id = v_item_id;

    -- Return to store inventory levels
    UPDATE public.store_inventory_levels
    SET quantity_on_hand = quantity_on_hand + v_total_qty,
        updated_at = NOW()
    WHERE store_id = v_store_id
      AND item_id = v_item_id;
  END IF;

  -- Mark all batch rows as rejected
  UPDATE public.inventory_distributions
  SET status = 'rejected',
      rejection_reason = p_rejection_reason,
      rejected_by_id = p_employee_id,
      rejected_at = NOW(),
      updated_at = NOW()
  WHERE distribution_batch_id = p_batch_id
    AND status NOT IN ('rejected', 'cancelled');

  RETURN json_build_object(
    'success', true,
    'reversed_count', v_reversed_count,
    'skipped_count', v_skipped_count,
    'total_quantity_returned', v_total_qty
  );
END;
$function$;

-- 4. get_distribution_batch_details RPC — returns per-row details for View modal
CREATE OR REPLACE FUNCTION public.get_distribution_batch_details(
  p_batch_id uuid
)
RETURNS TABLE (
  distribution_id uuid,
  distribution_number text,
  item_name text,
  lot_number text,
  to_employee_name text,
  distributed_by_name text,
  quantity numeric,
  unit_cost numeric,
  distribution_date timestamptz,
  status text,
  condition_notes text,
  manager_approved boolean,
  manager_approved_by_name text,
  manager_approved_at timestamptz,
  rejection_reason text,
  rejected_by_name text,
  rejected_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    d.id AS distribution_id,
    d.distribution_number,
    COALESCE(ii.name, 'Unknown Item') AS item_name,
    COALESCE(pl.lot_number, 'N/A') AS lot_number,
    COALESCE(te.display_name, te.legal_name, 'Unknown') AS to_employee_name,
    COALESCE(de.display_name, de.legal_name, 'Unknown') AS distributed_by_name,
    d.quantity,
    d.unit_cost,
    d.distribution_date,
    d.status,
    d.condition_notes,
    d.manager_approved,
    COALESCE(me.display_name, me.legal_name) AS manager_approved_by_name,
    d.manager_approved_at,
    d.rejection_reason,
    COALESCE(re.display_name, re.legal_name) AS rejected_by_name,
    d.rejected_at
  FROM public.inventory_distributions d
  LEFT JOIN public.inventory_items ii ON ii.id = d.item_id
  LEFT JOIN public.inventory_purchase_lots pl ON pl.id = d.lot_id
  LEFT JOIN public.employees te ON te.id = d.to_employee_id
  LEFT JOIN public.employees de ON de.id = d.distributed_by_id
  LEFT JOIN public.employees me ON me.id = d.manager_approved_by_id
  LEFT JOIN public.employees re ON re.id = d.rejected_by_id
  WHERE d.distribution_batch_id = p_batch_id
  ORDER BY d.created_at;
$function$;

-- 5. Update get_pending_distribution_approvals to exclude rejected/cancelled rows
-- The acknowledge branch already filters status = 'pending', but the manager branch
-- only checks manager_approved = false — add explicit exclusion for rejected/cancelled
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
    AND d.distributed_by_id != p_employee_id
    AND d.status NOT IN ('rejected', 'cancelled')
    AND d.distribution_batch_id IS NOT NULL
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

-- 6. Grants
GRANT EXECUTE ON FUNCTION public.reject_distribution(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_distribution_batch_details(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
