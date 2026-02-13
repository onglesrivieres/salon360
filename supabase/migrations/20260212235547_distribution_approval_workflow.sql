-- Distribution Approval Workflow
-- Adds post-facto confirmations for inventory distributions:
-- 1. Employee acknowledgment (pending → acknowledged)
-- 2. Management approval (manager_approved = true)
-- Stock moves immediately (current behavior). Both confirmations are post-facto.

-- 1.1 New columns on inventory_distributions
ALTER TABLE public.inventory_distributions
  ADD COLUMN IF NOT EXISTS distribution_batch_id uuid,
  ADD COLUMN IF NOT EXISTS manager_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_approved_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS distributed_by_role text;

CREATE INDEX IF NOT EXISTS idx_inventory_distributions_batch_id
  ON public.inventory_distributions(distribution_batch_id);

-- 1.2 Backfill existing rows so they don't appear as pending
UPDATE public.inventory_distributions
SET manager_approved = true,
    distribution_batch_id = gen_random_uuid()
WHERE distribution_batch_id IS NULL;

-- 1.3 Update distribute_to_employee RPC with batch_id and role tracking
CREATE OR REPLACE FUNCTION public.distribute_to_employee(
  p_store_id uuid,
  p_item_id uuid,
  p_to_employee_id uuid,
  p_quantity numeric,
  p_distributed_by_id uuid,
  p_notes text DEFAULT ''::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining_qty numeric;
  v_lot record;
  v_dist_qty numeric;
  v_distribution_number text;
  v_distribution_id uuid;
  v_distributions json[];
  v_batch_id uuid;
  v_distributor_role text;
  v_auto_approved boolean;
BEGIN
  v_remaining_qty := p_quantity;
  v_distributions := ARRAY[]::json[];
  v_batch_id := gen_random_uuid();

  -- Look up distributor's highest role
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
  END INTO v_distributor_role
  FROM public.employees e
  WHERE e.id = p_distributed_by_id;

  -- Admin distributions are auto-approved (no upper management to approve)
  v_auto_approved := (v_distributor_role = 'Admin');

  -- Check availability across the item itself and any sub-items
  IF (SELECT COALESCE(SUM(quantity_remaining), 0) FROM public.inventory_purchase_lots
      WHERE store_id = p_store_id
        AND item_id IN (SELECT id FROM public.inventory_items WHERE id = p_item_id OR parent_id = p_item_id)
        AND status = 'active' AND quantity_remaining > 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory available. Requested: %, Available: %',
      p_quantity,
      (SELECT COALESCE(SUM(quantity_remaining), 0) FROM public.inventory_purchase_lots
       WHERE store_id = p_store_id
         AND item_id IN (SELECT id FROM public.inventory_items WHERE id = p_item_id OR parent_id = p_item_id)
         AND status = 'active' AND quantity_remaining > 0);
  END IF;

  -- FIFO lot allocation across the item itself and any sub-items
  FOR v_lot IN
    SELECT id, lot_number, quantity_remaining, unit_cost, purchase_date
    FROM public.inventory_purchase_lots
    WHERE store_id = p_store_id
      AND item_id IN (SELECT id FROM public.inventory_items WHERE id = p_item_id OR parent_id = p_item_id)
      AND status = 'active' AND quantity_remaining > 0
    ORDER BY purchase_date ASC, created_at ASC
  LOOP
    EXIT WHEN v_remaining_qty <= 0;
    v_dist_qty := LEAST(v_remaining_qty, v_lot.quantity_remaining);
    v_distribution_number := 'DIST-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('distribution_seq')::text, 4, '0');

    INSERT INTO public.inventory_distributions (
      distribution_number, store_id, item_id, lot_id, from_type, to_employee_id,
      quantity, unit_cost, distribution_date, distributed_by_id, condition_notes, status,
      distribution_batch_id, distributed_by_role, manager_approved, manager_approved_by_id, manager_approved_at
    ) VALUES (
      v_distribution_number, p_store_id, p_item_id, v_lot.id, 'store', p_to_employee_id,
      v_dist_qty, v_lot.unit_cost, NOW(), p_distributed_by_id, p_notes, 'pending',
      v_batch_id, v_distributor_role, v_auto_approved,
      CASE WHEN v_auto_approved THEN p_distributed_by_id ELSE NULL END,
      CASE WHEN v_auto_approved THEN NOW() ELSE NULL END
    ) RETURNING id INTO v_distribution_id;

    UPDATE public.inventory_purchase_lots
    SET quantity_remaining = quantity_remaining - v_dist_qty,
        status = CASE WHEN quantity_remaining - v_dist_qty <= 0 THEN 'depleted' ELSE 'active' END, updated_at = NOW()
    WHERE id = v_lot.id;

    INSERT INTO public.employee_inventory (employee_id, store_id, item_id, quantity_on_hand, total_value, updated_at)
    VALUES (p_to_employee_id, p_store_id, p_item_id, v_dist_qty, v_dist_qty * v_lot.unit_cost, NOW())
    ON CONFLICT (employee_id, item_id) DO UPDATE SET
      quantity_on_hand = employee_inventory.quantity_on_hand + v_dist_qty,
      total_value = employee_inventory.total_value + (v_dist_qty * v_lot.unit_cost), updated_at = NOW();

    INSERT INTO public.employee_inventory_lots (employee_id, store_id, item_id, lot_id, quantity, unit_cost, distributed_date)
    VALUES (p_to_employee_id, p_store_id, p_item_id, v_lot.id, v_dist_qty, v_lot.unit_cost, NOW());

    v_distributions := array_append(v_distributions, json_build_object(
      'distribution_id', v_distribution_id, 'distribution_number', v_distribution_number,
      'lot_number', v_lot.lot_number, 'quantity', v_dist_qty, 'unit_cost', v_lot.unit_cost
    ));
    v_remaining_qty := v_remaining_qty - v_dist_qty;
  END LOOP;

  -- Deduct from store inventory levels (tracks stock at master/standalone item level)
  UPDATE public.store_inventory_levels
  SET quantity_on_hand = quantity_on_hand - p_quantity, updated_at = NOW()
  WHERE store_id = p_store_id AND item_id = p_item_id;

  RETURN json_build_object('success', true, 'total_quantity', p_quantity, 'batch_id', v_batch_id, 'distributions', array_to_json(v_distributions));
END;
$function$;

-- 1.4 New RPC: get_pending_distribution_approvals
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
    COALESCE(ii.item_name, 'Unknown Item') AS item_name,
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
  GROUP BY d.distribution_batch_id, d.item_id, ii.item_name, d.to_employee_id, te.display_name, te.legal_name,
           d.distributed_by_id, de.display_name, de.legal_name, d.distributed_by_role

  UNION ALL

  -- Manager approval: distributions not yet manager-approved, where viewer outranks creator
  SELECT
    d.distribution_batch_id AS batch_id,
    d.item_id,
    COALESCE(ii.item_name, 'Unknown Item') AS item_name,
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
  GROUP BY d.distribution_batch_id, d.item_id, ii.item_name, d.to_employee_id, te.display_name, te.legal_name,
           d.distributed_by_id, de.display_name, de.legal_name, d.distributed_by_role;

  RETURN;
END;
$function$;

-- 1.5 New RPC: acknowledge_distribution
CREATE OR REPLACE FUNCTION public.acknowledge_distribution(
  p_batch_id uuid,
  p_employee_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Validate: must be the recipient and status must be 'pending'
  SELECT COUNT(*) INTO v_count
  FROM public.inventory_distributions
  WHERE distribution_batch_id = p_batch_id
    AND to_employee_id = p_employee_id
    AND status = 'pending';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'No pending distributions found for this batch and employee';
  END IF;

  -- Update all rows in the batch
  UPDATE public.inventory_distributions
  SET status = 'acknowledged',
      acknowledged_at = NOW(),
      updated_at = NOW()
  WHERE distribution_batch_id = p_batch_id
    AND to_employee_id = p_employee_id
    AND status = 'pending';

  RETURN json_build_object('success', true, 'acknowledged_count', v_count);
END;
$function$;

-- 1.6 New RPC: approve_distribution_by_manager
CREATE OR REPLACE FUNCTION public.approve_distribution_by_manager(
  p_batch_id uuid,
  p_employee_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_creator_id uuid;
  v_creator_role text;
  v_approver_role text;
  v_outranks boolean;
BEGIN
  -- Get the creator info from the batch
  SELECT distributed_by_id, distributed_by_role INTO v_creator_id, v_creator_role
  FROM public.inventory_distributions
  WHERE distribution_batch_id = p_batch_id
    AND manager_approved = false
  LIMIT 1;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'No unapproved distributions found for this batch';
  END IF;

  -- Block self-approval
  IF v_creator_id = p_employee_id THEN
    RAISE EXCEPTION 'Cannot approve your own distribution';
  END IF;

  -- Look up approver's highest role
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
  END INTO v_approver_role
  FROM public.employees e
  WHERE e.id = p_employee_id;

  -- Check hierarchy: approver must outrank creator
  v_outranks := CASE
    WHEN v_creator_role = 'Owner' THEN v_approver_role IN ('Admin')
    WHEN v_creator_role = 'Manager' THEN v_approver_role IN ('Admin', 'Owner')
    WHEN v_creator_role = 'Supervisor' THEN v_approver_role IN ('Admin', 'Owner', 'Manager')
    WHEN v_creator_role IN ('Receptionist', 'Cashier', 'Technician', 'Trainee') THEN v_approver_role IN ('Admin', 'Owner', 'Manager', 'Supervisor')
    ELSE false
  END;

  IF NOT v_outranks THEN
    RAISE EXCEPTION 'Insufficient role to approve this distribution';
  END IF;

  -- Update all rows in the batch
  UPDATE public.inventory_distributions
  SET manager_approved = true,
      manager_approved_by_id = p_employee_id,
      manager_approved_at = NOW(),
      updated_at = NOW()
  WHERE distribution_batch_id = p_batch_id
    AND manager_approved = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'approved_count', v_count);
END;
$function$;

-- 1.7 Grants
GRANT EXECUTE ON FUNCTION public.get_pending_distribution_approvals(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_distribution(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_distribution_by_manager(uuid, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
