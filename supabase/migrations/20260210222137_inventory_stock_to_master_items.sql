/*
  # Inventory Stock To Master Items

  ## Overview
  Moves inventory stock tracking from sub-items to master items. "In" approvals
  now route stock to the parent master item. "Out"/"Transfer" operate on master
  items directly (frontend sends master item IDs).

  ## Changes

  ### Data Migration
  - Aggregates existing sub-item quantity_on_hand into their parent master items
  - Zeros out sub-item stock (sub-items become purchase variants only)

  ### Functions
  - `update_inventory_on_transaction_approval` - "In" branch resolves item to
    parent master item before updating stock. Out/transfer unchanged.

  ## Notes
  - Purchase lots remain linked to sub-items (they track what was purchased)
  - Ensure store_inventory_levels rows exist for master items before migration
*/

-- ============================================================================
-- STEP 1: Ensure master items have store_inventory_levels rows
-- (they may not if stock was only tracked at sub-item level)
-- ============================================================================

INSERT INTO public.store_inventory_levels (store_id, item_id, quantity_on_hand, unit_cost, reorder_level, is_active, created_at, updated_at)
SELECT DISTINCT child_sil.store_id, ii.parent_id, 0, 0, 0, true, now(), now()
FROM public.store_inventory_levels child_sil
JOIN public.inventory_items ii ON ii.id = child_sil.item_id
WHERE ii.parent_id IS NOT NULL
ON CONFLICT (store_id, item_id) DO NOTHING;

-- ============================================================================
-- STEP 2: Aggregate sub-item quantities to their parent master item
-- ============================================================================

UPDATE public.store_inventory_levels sil
SET quantity_on_hand = sil.quantity_on_hand + sub_totals.total_qty,
    updated_at = now()
FROM (
  SELECT child_sil.store_id,
         ii.parent_id AS master_item_id,
         SUM(child_sil.quantity_on_hand) AS total_qty
  FROM public.store_inventory_levels child_sil
  JOIN public.inventory_items ii ON ii.id = child_sil.item_id
  WHERE ii.parent_id IS NOT NULL
    AND child_sil.quantity_on_hand > 0
  GROUP BY child_sil.store_id, ii.parent_id
) sub_totals
WHERE sil.store_id = sub_totals.store_id
  AND sil.item_id = sub_totals.master_item_id;

-- ============================================================================
-- STEP 3: Zero out sub-item stock
-- ============================================================================

UPDATE public.store_inventory_levels sil
SET quantity_on_hand = 0,
    updated_at = now()
FROM public.inventory_items ii
WHERE sil.item_id = ii.id
  AND ii.parent_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Update trigger — "In" resolves to parent master item
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_inventory_on_transaction_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_target_item_id uuid;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    FOR v_item IN
      SELECT item_id, quantity, received_quantity
      FROM public.inventory_transaction_items
      WHERE transaction_id = NEW.id
    LOOP
      IF NEW.transaction_type = 'in' THEN
        -- Resolve to parent master item (sub-items always have a parent)
        SELECT ii.parent_id
          INTO v_target_item_id
          FROM public.inventory_items ii
          WHERE ii.id = v_item.item_id;

        -- If no parent found, fall back to item itself (safety net)
        IF v_target_item_id IS NULL THEN
          v_target_item_id := v_item.item_id;
        END IF;

        -- Ensure store_inventory_levels row exists for the target item
        INSERT INTO public.store_inventory_levels (store_id, item_id, quantity_on_hand, unit_cost, reorder_level, is_active, created_at, updated_at)
        VALUES (NEW.store_id, v_target_item_id, 0, 0, 0, true, now(), now())
        ON CONFLICT (store_id, item_id) DO NOTHING;

        UPDATE public.store_inventory_levels
          SET quantity_on_hand = quantity_on_hand + v_item.quantity,
              updated_at = now()
          WHERE store_id = NEW.store_id AND item_id = v_target_item_id;

      ELSIF NEW.transaction_type = 'out' THEN
        UPDATE public.store_inventory_levels
          SET quantity_on_hand = quantity_on_hand - v_item.quantity,
              updated_at = now()
          WHERE store_id = NEW.store_id AND item_id = v_item.item_id;

      ELSIF NEW.transaction_type = 'transfer' THEN
        -- For transfers: deduct from source, add to destination
        -- Use received_quantity if set (partial receipt), otherwise full quantity
        UPDATE public.store_inventory_levels
          SET quantity_on_hand = quantity_on_hand - COALESCE(v_item.received_quantity, v_item.quantity),
              updated_at = now()
          WHERE store_id = NEW.store_id AND item_id = v_item.item_id;

        -- Add to destination store (insert if level doesn't exist)
        INSERT INTO public.store_inventory_levels (store_id, item_id, quantity_on_hand, unit_cost, reorder_level, is_active, created_at, updated_at)
        VALUES (NEW.destination_store_id, v_item.item_id, COALESCE(v_item.received_quantity, v_item.quantity), 0, 0, true, now(), now())
        ON CONFLICT (store_id, item_id)
        DO UPDATE SET
          quantity_on_hand = store_inventory_levels.quantity_on_hand + COALESCE(v_item.received_quantity, v_item.quantity),
          updated_at = now();
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
