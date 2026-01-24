/*
  # Update Inventory Functions for Per-Store Schema

  ## Overview
  Updates all database functions to work with the new per-store inventory schema.
  Replaces references to master_item_id with item_id throughout all functions.

  ## Changes
  - Updates insert_transaction_items_batch to remove master_item_id
  - Updates distribute_to_employee to use item_id
  - Updates all lot-based functions for new schema

  ## Impact
  - All inventory functions now work with store-specific items
  - No more references to centralized master_inventory_items
*/

-- =====================================================
-- Update insert_transaction_items_batch function
-- =====================================================

CREATE OR REPLACE FUNCTION public.insert_transaction_items_batch(
  p_transaction_id uuid,
  p_items jsonb
)
RETURNS TABLE(
  success boolean,
  items_inserted integer,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
BEGIN
  -- Validate transaction exists
  IF NOT EXISTS (SELECT 1 FROM public.inventory_transactions WHERE id = p_transaction_id) THEN
    RETURN QUERY SELECT false, 0, 'Transaction not found'::text;
    RETURN;
  END IF;

  -- Validate items array
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN QUERY SELECT false, 0, 'No items provided'::text;
    RETURN;
  END IF;

  -- Insert each item from the JSON array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.inventory_transaction_items (
      transaction_id,
      item_id,
      quantity,
      unit_cost,
      purchase_unit_id,
      purchase_quantity,
      purchase_unit_price,
      purchase_unit_multiplier,
      notes,
      created_at
    ) VALUES (
      p_transaction_id,
      (v_item->>'item_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_cost')::numeric,
      CASE WHEN v_item->>'purchase_unit_id' IS NOT NULL
        THEN (v_item->>'purchase_unit_id')::uuid
        ELSE NULL
      END,
      CASE WHEN v_item->>'purchase_quantity' IS NOT NULL
        THEN (v_item->>'purchase_quantity')::numeric
        ELSE NULL
      END,
      CASE WHEN v_item->>'purchase_unit_price' IS NOT NULL
        THEN (v_item->>'purchase_unit_price')::numeric
        ELSE NULL
      END,
      CASE WHEN v_item->>'purchase_unit_multiplier' IS NOT NULL
        THEN (v_item->>'purchase_unit_multiplier')::numeric
        ELSE NULL
      END,
      COALESCE(v_item->>'notes', ''),
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT true, v_count, 'Items inserted successfully'::text;
END;
$$;

COMMENT ON FUNCTION public.insert_transaction_items_batch IS
  'Batch inserts multiple transaction items for a given transaction.
   Accepts a JSON array of item objects with item_id (store-specific).
   Returns success status, count of items inserted, and a message.';

-- =====================================================
-- Drop and recreate distribute_to_employee function
-- =====================================================

DROP FUNCTION IF EXISTS public.distribute_to_employee(uuid,uuid,uuid,numeric,uuid,text);

CREATE OR REPLACE FUNCTION public.distribute_to_employee(
  p_store_id uuid,
  p_item_id uuid,
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
        AND item_id = p_item_id
        AND status = 'active'
        AND quantity_remaining > 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory available. Requested: %, Available: %',
      p_quantity,
      (SELECT COALESCE(SUM(quantity_remaining), 0)
       FROM public.inventory_purchase_lots
       WHERE store_id = p_store_id
         AND item_id = p_item_id
         AND status = 'active'
         AND quantity_remaining > 0);
  END IF;

  -- Process each lot in FIFO order
  FOR v_lot IN
    SELECT id, lot_number, quantity_remaining, unit_cost, purchase_date
    FROM public.inventory_purchase_lots
    WHERE store_id = p_store_id
      AND item_id = p_item_id
      AND status = 'active'
      AND quantity_remaining > 0
    ORDER BY purchase_date ASC, created_at ASC
  LOOP
    EXIT WHEN v_remaining_qty <= 0;

    -- Determine how much to take from this lot
    v_dist_qty := LEAST(v_remaining_qty, v_lot.quantity_remaining);

    -- Generate distribution number
    v_distribution_number := 'DIST-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                             LPAD(NEXTVAL('distribution_seq')::text, 4, '0');

    -- Create distribution record
    INSERT INTO public.inventory_distributions (
      distribution_number,
      store_id,
      item_id,
      lot_id,
      from_type,
      to_employee_id,
      quantity,
      unit_cost,
      distribution_date,
      distributed_by_id,
      condition_notes,
      status
    ) VALUES (
      v_distribution_number,
      p_store_id,
      p_item_id,
      v_lot.id,
      'store',
      p_to_employee_id,
      v_dist_qty,
      v_lot.unit_cost,
      NOW(),
      p_distributed_by_id,
      p_notes,
      'pending'
    )
    RETURNING id INTO v_distribution_id;

    -- Update lot quantity
    UPDATE public.inventory_purchase_lots
    SET quantity_remaining = quantity_remaining - v_dist_qty,
        status = CASE WHEN quantity_remaining - v_dist_qty <= 0 THEN 'depleted' ELSE 'active' END,
        updated_at = NOW()
    WHERE id = v_lot.id;

    -- Update or create employee inventory record
    INSERT INTO public.employee_inventory (
      employee_id,
      store_id,
      item_id,
      quantity_on_hand,
      total_value,
      updated_at
    ) VALUES (
      p_to_employee_id,
      p_store_id,
      p_item_id,
      v_dist_qty,
      v_dist_qty * v_lot.unit_cost,
      NOW()
    )
    ON CONFLICT (employee_id, item_id)
    DO UPDATE SET
      quantity_on_hand = employee_inventory.quantity_on_hand + v_dist_qty,
      total_value = employee_inventory.total_value + (v_dist_qty * v_lot.unit_cost),
      updated_at = NOW();

    -- Create employee_inventory_lots record
    INSERT INTO public.employee_inventory_lots (
      employee_id,
      store_id,
      item_id,
      lot_id,
      quantity,
      unit_cost,
      distributed_date
    ) VALUES (
      p_to_employee_id,
      p_store_id,
      p_item_id,
      v_lot.id,
      v_dist_qty,
      v_lot.unit_cost,
      NOW()
    );

    -- Add to results array
    v_distributions := array_append(v_distributions, json_build_object(
      'distribution_id', v_distribution_id,
      'distribution_number', v_distribution_number,
      'lot_number', v_lot.lot_number,
      'quantity', v_dist_qty,
      'unit_cost', v_lot.unit_cost
    ));

    v_remaining_qty := v_remaining_qty - v_dist_qty;
  END LOOP;

  -- Build result
  v_result := json_build_object(
    'success', true,
    'total_quantity', p_quantity,
    'distributions', array_to_json(v_distributions)
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.distribute_to_employee IS
  'Distributes inventory to an employee using FIFO lot allocation.
   Uses store-specific item_id instead of master_item_id.
   Returns JSON with distribution details.';

-- =====================================================
-- Drop and recreate product preference function
-- =====================================================

DROP FUNCTION IF EXISTS public.update_product_preference(uuid,uuid,uuid,numeric,uuid);

CREATE OR REPLACE FUNCTION public.update_product_preference(
  p_store_id uuid,
  p_item_id uuid,
  p_purchase_unit_id uuid,
  p_purchase_cost numeric,
  p_updated_by_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_product_preferences (
    store_id,
    item_id,
    last_used_purchase_unit_id,
    last_purchase_cost,
    last_used_at,
    updated_by_id,
    created_at,
    updated_at
  ) VALUES (
    p_store_id,
    p_item_id,
    p_purchase_unit_id,
    p_purchase_cost,
    NOW(),
    p_updated_by_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (store_id, item_id)
  DO UPDATE SET
    last_used_purchase_unit_id = p_purchase_unit_id,
    last_purchase_cost = p_purchase_cost,
    last_used_at = NOW(),
    updated_by_id = p_updated_by_id,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION public.update_product_preference IS
  'Updates or creates product purchase preferences for a store-specific item.
   Tracks last used purchase unit and cost for faster data entry.';

-- =====================================================
-- Create sequence for distribution numbers if not exists
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS distribution_seq START 1;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
