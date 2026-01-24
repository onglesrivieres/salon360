/*
  # Fix Lot Functions - Use item_id Instead of master_item_id

  ## Problem
  The functions `get_available_lots_fifo` and `calculate_weighted_average_cost`
  still reference `master_item_id` column which no longer exists in `inventory_purchase_lots`.
  The table now uses `item_id`.

  ## Fix
  Drop and recreate both functions to use `item_id` instead of `master_item_id`.
  (Cannot rename parameters with CREATE OR REPLACE, must drop first)
*/

-- Drop existing functions (cannot rename parameters with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.get_available_lots_fifo(uuid, uuid);
DROP FUNCTION IF EXISTS public.calculate_weighted_average_cost(uuid, uuid);

-- Recreate get_available_lots_fifo to use item_id
CREATE OR REPLACE FUNCTION public.get_available_lots_fifo(
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

COMMENT ON FUNCTION public.get_available_lots_fifo IS
  'Returns available lots for an item ordered by FIFO (First In, First Out) for cost tracking. Uses item_id to reference inventory_items.';

-- Update calculate_weighted_average_cost to use item_id
CREATE OR REPLACE FUNCTION public.calculate_weighted_average_cost(
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

COMMENT ON FUNCTION public.calculate_weighted_average_cost IS
  'Calculates weighted average cost across all active lots for an item. Uses item_id to reference inventory_items.';

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
