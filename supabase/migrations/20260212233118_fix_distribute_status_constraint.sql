-- Fix distribute_to_employee: change inserted status from 'completed' to 'pending'
-- The check constraint inventory_distributions_status_valid only allows:
-- ('pending', 'acknowledged', 'in_use', 'returned', 'consumed', 'cancelled')
-- This matches the documented distribution workflow: pending → acknowledged → in_use → returned/consumed

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
BEGIN
  v_remaining_qty := p_quantity;
  v_distributions := ARRAY[]::json[];

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
      quantity, unit_cost, distribution_date, distributed_by_id, condition_notes, status
    ) VALUES (
      v_distribution_number, p_store_id, p_item_id, v_lot.id, 'store', p_to_employee_id,
      v_dist_qty, v_lot.unit_cost, NOW(), p_distributed_by_id, p_notes, 'pending'
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

  RETURN json_build_object('success', true, 'total_quantity', p_quantity, 'distributions', array_to_json(v_distributions));
END;
$function$;

NOTIFY pgrst, 'reload schema';
