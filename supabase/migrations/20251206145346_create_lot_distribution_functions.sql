/*
  # Create Lot-Based Distribution Functions

  ## Overview
  Implements core business logic for distributing inventory to employees using
  FIFO (First In, First Out) costing. Handles lot depletion, employee inventory
  updates, and complete audit trail creation.

  ## Functions

  ### distribute_to_employee
  Main distribution function that:
  - Allocates inventory from oldest lots first (FIFO)
  - Creates distribution records
  - Updates lot quantities
  - Updates employee inventory
  - Maintains audit trail

  ### return_from_employee
  Handles returns from employees:
  - Returns items back to store inventory
  - Updates employee inventory
  - Creates return distribution record
  - Updates lot quantities

  ### consume_employee_inventory
  Records consumption/usage:
  - Removes from employee inventory
  - Updates lot tracking
  - Creates consumption record

  ## Benefits
  - Automatic FIFO cost allocation
  - Complete audit trail
  - Prevents over-distribution
  - Maintains lot traceability
*/

-- Step 1: Create function to distribute inventory to employee
CREATE OR REPLACE FUNCTION public.distribute_to_employee(
  p_store_id uuid,
  p_master_item_id uuid,
  p_to_employee_id uuid,
  p_quantity numeric,
  p_distributed_by_id uuid,
  p_notes text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_qty numeric;
  v_lot record;
  v_dist_qty numeric;
  v_distribution_number text;
  v_distribution_id uuid;
  v_distributions json[];
  v_result json;
BEGIN
  v_remaining_qty := p_quantity;
  v_distributions := ARRAY[]::json[];

  -- Validate sufficient stock exists
  IF (SELECT COALESCE(SUM(quantity_remaining), 0)
      FROM public.inventory_purchase_lots
      WHERE store_id = p_store_id
        AND master_item_id = p_master_item_id
        AND status = 'active'
        AND quantity_remaining > 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory available. Requested: %, Available: %',
      p_quantity,
      (SELECT COALESCE(SUM(quantity_remaining), 0)
       FROM public.inventory_purchase_lots
       WHERE store_id = p_store_id
         AND master_item_id = p_master_item_id
         AND status = 'active'
         AND quantity_remaining > 0);
  END IF;

  -- Process each lot in FIFO order
  FOR v_lot IN
    SELECT id, lot_number, quantity_remaining, unit_cost, purchase_date
    FROM public.inventory_purchase_lots
    WHERE store_id = p_store_id
      AND master_item_id = p_master_item_id
      AND status = 'active'
      AND quantity_remaining > 0
    ORDER BY purchase_date ASC, created_at ASC
  LOOP
    EXIT WHEN v_remaining_qty <= 0;

    -- Determine how much to take from this lot
    v_dist_qty := LEAST(v_remaining_qty, v_lot.quantity_remaining);

    -- Generate distribution number
    v_distribution_number := public.generate_distribution_number(p_store_id);

    -- Create distribution record
    INSERT INTO public.inventory_distributions (
      distribution_number,
      store_id,
      master_item_id,
      lot_id,
      from_type,
      to_employee_id,
      quantity,
      unit_cost,
      distribution_date,
      status,
      condition_notes,
      distributed_by_id
    ) VALUES (
      v_distribution_number,
      p_store_id,
      p_master_item_id,
      v_lot.id,
      'store',
      p_to_employee_id,
      v_dist_qty,
      v_lot.unit_cost,
      now(),
      'acknowledged',
      p_notes,
      p_distributed_by_id
    ) RETURNING id INTO v_distribution_id;

    -- Update lot quantity
    UPDATE public.inventory_purchase_lots
    SET quantity_remaining = quantity_remaining - v_dist_qty,
        updated_at = now()
    WHERE id = v_lot.id;

    -- Add to employee inventory lots
    INSERT INTO public.employee_inventory_lots (
      employee_id,
      store_id,
      master_item_id,
      lot_id,
      quantity,
      unit_cost,
      distributed_date
    ) VALUES (
      p_to_employee_id,
      p_store_id,
      p_master_item_id,
      v_lot.id,
      v_dist_qty,
      v_lot.unit_cost,
      now()
    );

    -- Track distribution details
    v_distributions := array_append(v_distributions, json_build_object(
      'distribution_id', v_distribution_id,
      'distribution_number', v_distribution_number,
      'lot_number', v_lot.lot_number,
      'quantity', v_dist_qty,
      'unit_cost', v_lot.unit_cost
    ));

    v_remaining_qty := v_remaining_qty - v_dist_qty;
  END LOOP;

  -- Update employee inventory summary
  PERFORM public.refresh_employee_inventory_summary(p_to_employee_id, p_master_item_id);

  -- Update store inventory stock
  UPDATE public.store_inventory_stock
  SET quantity_on_hand = quantity_on_hand - p_quantity,
      updated_at = now()
  WHERE store_id = p_store_id
    AND item_id = p_master_item_id;

  -- Build result
  v_result := json_build_object(
    'success', true,
    'total_quantity', p_quantity,
    'distributions', array_to_json(v_distributions)
  );

  RETURN v_result;
END;
$$;

-- Step 2: Create function to return inventory from employee
CREATE OR REPLACE FUNCTION public.return_from_employee(
  p_employee_id uuid,
  p_master_item_id uuid,
  p_quantity numeric,
  p_returned_by_id uuid,
  p_notes text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_qty numeric;
  v_emp_lot record;
  v_return_qty numeric;
  v_store_id uuid;
  v_result json;
BEGIN
  v_remaining_qty := p_quantity;

  -- Get employee's store
  SELECT es.store_id INTO v_store_id
  FROM public.employee_stores es
  WHERE es.employee_id = p_employee_id
  LIMIT 1;

  -- Validate employee has enough inventory
  IF (SELECT COALESCE(SUM(quantity), 0)
      FROM public.employee_inventory_lots
      WHERE employee_id = p_employee_id
        AND master_item_id = p_master_item_id) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient employee inventory. Requested: %, Available: %',
      p_quantity,
      (SELECT COALESCE(SUM(quantity), 0)
       FROM public.employee_inventory_lots
       WHERE employee_id = p_employee_id
         AND master_item_id = p_master_item_id);
  END IF;

  -- Process each employee lot in FIFO order
  FOR v_emp_lot IN
    SELECT id, lot_id, quantity, unit_cost, distributed_date
    FROM public.employee_inventory_lots
    WHERE employee_id = p_employee_id
      AND master_item_id = p_master_item_id
    ORDER BY distributed_date ASC
  LOOP
    EXIT WHEN v_remaining_qty <= 0;

    -- Determine how much to return from this lot
    v_return_qty := LEAST(v_remaining_qty, v_emp_lot.quantity);

    -- Return quantity to lot
    UPDATE public.inventory_purchase_lots
    SET quantity_remaining = quantity_remaining + v_return_qty,
        status = 'active',
        updated_at = now()
    WHERE id = v_emp_lot.lot_id;

    -- Remove or update employee lot record
    IF v_return_qty >= v_emp_lot.quantity THEN
      DELETE FROM public.employee_inventory_lots WHERE id = v_emp_lot.id;
    ELSE
      UPDATE public.employee_inventory_lots
      SET quantity = quantity - v_return_qty,
          updated_at = now()
      WHERE id = v_emp_lot.id;
    END IF;

    v_remaining_qty := v_remaining_qty - v_return_qty;
  END LOOP;

  -- Update employee inventory summary
  PERFORM public.refresh_employee_inventory_summary(p_employee_id, p_master_item_id);

  -- Update store inventory stock
  UPDATE public.store_inventory_stock
  SET quantity_on_hand = quantity_on_hand + p_quantity,
      updated_at = now()
  WHERE store_id = v_store_id
    AND item_id = p_master_item_id;

  v_result := json_build_object(
    'success', true,
    'returned_quantity', p_quantity
  );

  RETURN v_result;
END;
$$;

-- Step 3: Create function to record consumption
CREATE OR REPLACE FUNCTION public.consume_employee_inventory(
  p_employee_id uuid,
  p_master_item_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining_qty numeric;
  v_emp_lot record;
  v_consume_qty numeric;
  v_result json;
BEGIN
  v_remaining_qty := p_quantity;

  -- Validate employee has enough inventory
  IF (SELECT COALESCE(SUM(quantity), 0)
      FROM public.employee_inventory_lots
      WHERE employee_id = p_employee_id
        AND master_item_id = p_master_item_id) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient employee inventory for consumption';
  END IF;

  -- Process each employee lot in FIFO order
  FOR v_emp_lot IN
    SELECT id, lot_id, quantity, unit_cost, distributed_date
    FROM public.employee_inventory_lots
    WHERE employee_id = p_employee_id
      AND master_item_id = p_master_item_id
    ORDER BY distributed_date ASC
  LOOP
    EXIT WHEN v_remaining_qty <= 0;

    v_consume_qty := LEAST(v_remaining_qty, v_emp_lot.quantity);

    -- Remove or update employee lot record
    IF v_consume_qty >= v_emp_lot.quantity THEN
      DELETE FROM public.employee_inventory_lots WHERE id = v_emp_lot.id;
    ELSE
      UPDATE public.employee_inventory_lots
      SET quantity = quantity - v_consume_qty,
          updated_at = now()
      WHERE id = v_emp_lot.id;
    END IF;

    v_remaining_qty := v_remaining_qty - v_consume_qty;
  END LOOP;

  -- Update employee inventory summary
  PERFORM public.refresh_employee_inventory_summary(p_employee_id, p_master_item_id);

  v_result := json_build_object(
    'success', true,
    'consumed_quantity', p_quantity
  );

  RETURN v_result;
END;
$$;

-- Step 4: Add helpful comments
COMMENT ON FUNCTION public.distribute_to_employee IS
  'Distributes inventory to employee using FIFO costing. Automatically allocates
   from oldest lots first, creates distribution records, and maintains audit trail.';

COMMENT ON FUNCTION public.return_from_employee IS
  'Returns inventory from employee back to store. Updates lots and employee inventory
   using FIFO order for consistency.';

COMMENT ON FUNCTION public.consume_employee_inventory IS
  'Records consumption of inventory by employee. Removes from employee holdings
   using FIFO order for accurate cost tracking.';
