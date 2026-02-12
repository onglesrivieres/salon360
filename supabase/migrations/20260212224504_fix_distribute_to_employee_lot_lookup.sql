-- Fix inventory distribution functions after stock-to-master migration
--
-- Problems found:
-- 1. distribute_to_employee queries lots WHERE item_id = <master_item_id>, but
--    purchase lots still reference sub-items → "Insufficient inventory" error
-- 2. return_from_employee, consume_employee_inventory, and refresh_employee_inventory_summary
--    reference non-existent master_item_id column (actual column is item_id)
-- 3. distribute_to_employee never deducts from store_inventory_levels
-- 4. return_from_employee references non-existent store_inventory_stock table
--
-- Fixes:
-- - distribute_to_employee: lot lookup includes sub-items via IN clause + deducts store_inventory_levels
-- - return_from_employee: fix column refs + restore store_inventory_levels
-- - consume_employee_inventory: fix column refs
-- - refresh_employee_inventory_summary: fix column refs

-- ============================================================================
-- DROP broken functions (parameter names changed, can't use CREATE OR REPLACE)
-- ============================================================================
DROP FUNCTION IF EXISTS public.return_from_employee(uuid, uuid, numeric, uuid, text);
DROP FUNCTION IF EXISTS public.consume_employee_inventory(uuid, uuid, numeric, text);
DROP FUNCTION IF EXISTS public.refresh_employee_inventory_summary(uuid, uuid);

-- ============================================================================
-- FUNCTION: distribute_to_employee (fixed lot lookup + store_inventory_levels)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.distribute_to_employee(
  p_store_id uuid, p_item_id uuid, p_to_employee_id uuid,
  p_quantity numeric, p_distributed_by_id uuid, p_notes text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
      v_dist_qty, v_lot.unit_cost, NOW(), p_distributed_by_id, p_notes, 'completed'
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
$$;

-- ============================================================================
-- FUNCTION: refresh_employee_inventory_summary (fix column refs)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refresh_employee_inventory_summary(p_employee_id uuid, p_item_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_quantity numeric;
  v_total_value numeric;
  v_store_id uuid;
BEGIN
  SELECT es.store_id INTO v_store_id FROM public.employee_stores es WHERE es.employee_id = p_employee_id LIMIT 1;
  SELECT COALESCE(SUM(quantity), 0), COALESCE(SUM(quantity * unit_cost), 0)
  INTO v_total_quantity, v_total_value
  FROM public.employee_inventory_lots WHERE employee_id = p_employee_id AND item_id = p_item_id;

  INSERT INTO public.employee_inventory (employee_id, store_id, item_id, quantity_on_hand, total_value, updated_at)
  VALUES (p_employee_id, v_store_id, p_item_id, v_total_quantity, v_total_value, now())
  ON CONFLICT (employee_id, item_id) DO UPDATE SET
    quantity_on_hand = v_total_quantity, total_value = v_total_value, updated_at = now();

  IF v_total_quantity = 0 THEN
    DELETE FROM public.employee_inventory WHERE employee_id = p_employee_id AND item_id = p_item_id;
  END IF;
END;
$$;

-- ============================================================================
-- FUNCTION: return_from_employee (fix column refs + store_inventory_levels)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.return_from_employee(
  p_employee_id uuid, p_item_id uuid, p_quantity numeric, p_returned_by_id uuid, p_notes text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_remaining_qty numeric;
  v_emp_lot record;
  v_return_qty numeric;
  v_store_id uuid;
BEGIN
  v_remaining_qty := p_quantity;
  IF (SELECT COALESCE(SUM(quantity), 0) FROM public.employee_inventory_lots
      WHERE employee_id = p_employee_id AND item_id = p_item_id) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient employee inventory';
  END IF;

  -- Get the store_id from the employee's inventory lots
  SELECT store_id INTO v_store_id FROM public.employee_inventory_lots
  WHERE employee_id = p_employee_id AND item_id = p_item_id LIMIT 1;

  FOR v_emp_lot IN
    SELECT id, lot_id, quantity, unit_cost, distributed_date FROM public.employee_inventory_lots
    WHERE employee_id = p_employee_id AND item_id = p_item_id ORDER BY distributed_date ASC
  LOOP
    EXIT WHEN v_remaining_qty <= 0;
    v_return_qty := LEAST(v_remaining_qty, v_emp_lot.quantity);

    UPDATE public.inventory_purchase_lots
    SET quantity_remaining = quantity_remaining + v_return_qty, status = 'active', updated_at = now()
    WHERE id = v_emp_lot.lot_id;

    IF v_return_qty >= v_emp_lot.quantity THEN
      DELETE FROM public.employee_inventory_lots WHERE id = v_emp_lot.id;
    ELSE
      UPDATE public.employee_inventory_lots SET quantity = quantity - v_return_qty, updated_at = now() WHERE id = v_emp_lot.id;
    END IF;
    v_remaining_qty := v_remaining_qty - v_return_qty;
  END LOOP;

  -- Restore to store inventory levels
  IF v_store_id IS NOT NULL THEN
    UPDATE public.store_inventory_levels
    SET quantity_on_hand = quantity_on_hand + p_quantity, updated_at = NOW()
    WHERE store_id = v_store_id AND item_id = p_item_id;
  END IF;

  PERFORM public.refresh_employee_inventory_summary(p_employee_id, p_item_id);
  RETURN json_build_object('success', true, 'returned_quantity', p_quantity);
END;
$$;

-- ============================================================================
-- FUNCTION: consume_employee_inventory (fix column refs)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consume_employee_inventory(
  p_employee_id uuid, p_item_id uuid, p_quantity numeric, p_notes text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_remaining_qty numeric;
  v_emp_lot record;
  v_consume_qty numeric;
BEGIN
  v_remaining_qty := p_quantity;
  IF (SELECT COALESCE(SUM(quantity), 0) FROM public.employee_inventory_lots
      WHERE employee_id = p_employee_id AND item_id = p_item_id) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient employee inventory for consumption';
  END IF;

  FOR v_emp_lot IN
    SELECT id, lot_id, quantity, unit_cost FROM public.employee_inventory_lots
    WHERE employee_id = p_employee_id AND item_id = p_item_id ORDER BY distributed_date ASC
  LOOP
    EXIT WHEN v_remaining_qty <= 0;
    v_consume_qty := LEAST(v_remaining_qty, v_emp_lot.quantity);
    IF v_consume_qty >= v_emp_lot.quantity THEN
      DELETE FROM public.employee_inventory_lots WHERE id = v_emp_lot.id;
    ELSE
      UPDATE public.employee_inventory_lots SET quantity = quantity - v_consume_qty, updated_at = now() WHERE id = v_emp_lot.id;
    END IF;
    v_remaining_qty := v_remaining_qty - v_consume_qty;
  END LOOP;

  PERFORM public.refresh_employee_inventory_summary(p_employee_id, p_item_id);
  RETURN json_build_object('success', true, 'consumed_quantity', p_quantity);
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
