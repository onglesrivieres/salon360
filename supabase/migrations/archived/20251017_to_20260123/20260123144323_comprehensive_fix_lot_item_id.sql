/*
  # Comprehensive Fix: Lot Functions Use item_id

  ## Problem
  Multiple conflicting migrations exist with different versions of functions.
  Some use `master_item_id` (which may not exist), others use `item_id`.
  This causes "column master_item_id does not exist" errors.

  ## Solution
  DROP and recreate ALL lot-related functions to guarantee they use `item_id`.
  This will override any previous conflicting versions.
*/

-- =====================================================
-- Step 1: Ensure item_id column exists
-- =====================================================
ALTER TABLE public.inventory_purchase_lots
ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES public.inventory_items(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_item_id
ON public.inventory_purchase_lots(item_id);

-- =====================================================
-- Step 2: Drop existing trigger (to avoid dependency issues)
-- =====================================================
DROP TRIGGER IF EXISTS trigger_create_lots_from_approved_transaction ON public.inventory_transactions;

-- =====================================================
-- Step 3: Drop and recreate create_lots_from_approved_transaction
-- =====================================================
DROP FUNCTION IF EXISTS public.create_lots_from_approved_transaction() CASCADE;

CREATE FUNCTION public.create_lots_from_approved_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_item record;
  v_lot_id uuid;
  v_lot_number text;
  v_supplier_id uuid;
  v_invoice_ref text;
BEGIN
  -- Only process IN transactions that just got approved
  IF NEW.transaction_type = 'in'
     AND NEW.status = 'approved'
     AND (OLD.status IS NULL OR OLD.status != 'approved')
     AND NEW.manager_approved = true
  THEN
    -- Get supplier and invoice reference from transaction
    v_supplier_id := NEW.supplier_id;
    v_invoice_ref := NEW.invoice_reference;

    -- Process each transaction item
    FOR v_transaction_item IN
      SELECT
        ti.id,
        ti.item_id,
        ti.quantity,
        ti.unit_cost,
        ti.purchase_unit_id,
        ti.purchase_quantity,
        ti.purchase_unit_multiplier,
        ti.notes,
        ii.store_id
      FROM public.inventory_transaction_items ti
      JOIN public.inventory_items ii ON ii.id = ti.item_id
      WHERE ti.transaction_id = NEW.id
    LOOP
      -- Generate lot number
      v_lot_number := public.generate_lot_number(
        v_transaction_item.store_id,
        NULL
      );

      -- Create purchase lot using item_id column
      INSERT INTO public.inventory_purchase_lots (
        lot_number,
        store_id,
        item_id,
        supplier_id,
        quantity_received,
        quantity_remaining,
        unit_cost,
        purchase_date,
        invoice_reference,
        notes,
        status,
        created_by_id,
        created_at,
        updated_at
      ) VALUES (
        v_lot_number,
        v_transaction_item.store_id,
        v_transaction_item.item_id,
        v_supplier_id,
        v_transaction_item.quantity,
        v_transaction_item.quantity,
        v_transaction_item.unit_cost,
        NEW.created_at,
        v_invoice_ref,
        CASE
          WHEN v_transaction_item.purchase_quantity IS NOT NULL THEN
            'Purchased: ' || v_transaction_item.purchase_quantity || ' units at multiplier ' || v_transaction_item.purchase_unit_multiplier || '. ' || v_transaction_item.notes
          ELSE
            v_transaction_item.notes
        END,
        'active',
        NEW.requested_by_id,
        now(),
        now()
      )
      RETURNING id INTO v_lot_id;

      -- Update transaction item with lot_id
      UPDATE public.inventory_transaction_items
      SET lot_id = v_lot_id
      WHERE id = v_transaction_item.id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- Step 4: Recreate the trigger
-- =====================================================
CREATE TRIGGER trigger_create_lots_from_approved_transaction
  AFTER UPDATE ON public.inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_lots_from_approved_transaction();

-- =====================================================
-- Step 5: Drop and recreate get_available_lots_fifo
-- =====================================================
DROP FUNCTION IF EXISTS public.get_available_lots_fifo(uuid, uuid);

CREATE FUNCTION public.get_available_lots_fifo(
  p_store_id uuid,
  p_item_id uuid
)
RETURNS TABLE (
  lot_id uuid,
  lot_number text,
  quantity_remaining numeric,
  unit_cost numeric,
  purchase_date timestamptz,
  expiration_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id as lot_id,
    l.lot_number,
    l.quantity_remaining,
    l.unit_cost,
    l.purchase_date,
    l.expiration_date
  FROM public.inventory_purchase_lots l
  WHERE l.store_id = p_store_id
    AND l.item_id = p_item_id
    AND l.status = 'active'
    AND l.quantity_remaining > 0
  ORDER BY l.purchase_date ASC, l.created_at ASC;
END;
$$;

-- =====================================================
-- Step 6: Drop and recreate calculate_weighted_average_cost
-- =====================================================
DROP FUNCTION IF EXISTS public.calculate_weighted_average_cost(uuid, uuid);

CREATE FUNCTION public.calculate_weighted_average_cost(
  p_store_id uuid,
  p_item_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weighted_avg numeric;
BEGIN
  SELECT
    CASE
      WHEN SUM(quantity_remaining) > 0 THEN
        SUM(quantity_remaining * unit_cost) / SUM(quantity_remaining)
      ELSE 0
    END
  INTO v_weighted_avg
  FROM public.inventory_purchase_lots
  WHERE store_id = p_store_id
    AND item_id = p_item_id
    AND status = 'active'
    AND quantity_remaining > 0;

  RETURN COALESCE(v_weighted_avg, 0);
END;
$$;

-- =====================================================
-- Step 7: Add comments
-- =====================================================
COMMENT ON FUNCTION public.create_lots_from_approved_transaction IS
  'Creates purchase lots when inventory IN transactions are approved. Uses item_id to reference inventory_items.';

COMMENT ON FUNCTION public.get_available_lots_fifo IS
  'Returns available lots for an item ordered by FIFO. Uses item_id to reference inventory_items.';

COMMENT ON FUNCTION public.calculate_weighted_average_cost IS
  'Calculates weighted average cost across all active lots. Uses item_id to reference inventory_items.';

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
