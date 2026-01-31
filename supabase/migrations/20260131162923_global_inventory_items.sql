/*
  # Global Inventory Items with Per-Store Levels

  ## Overview
  Makes inventory items a global catalog shared across all stores.
  Each store maintains its own inventory levels (quantity, reorder level, cost, active status).

  ## Changes
  1. Creates `store_inventory_levels` table for per-store inventory data
  2. Populates store_inventory_levels from existing inventory_items data
  3. Deduplicates items that exist across multiple stores (same name → keep earliest)
  4. Alters inventory_items: makes store_id nullable, changes unique constraint to global name
  5. Creates trigger to auto-create store_inventory_levels for all active stores on new item insert
  6. Updates all database functions to use store_inventory_levels instead of inventory_items for per-store data
*/

-- ============================================================================
-- STEP 1: Create store_inventory_levels table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.store_inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity_on_hand numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  reorder_level numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, item_id),
  CHECK (quantity_on_hand >= 0),
  CHECK (unit_cost >= 0),
  CHECK (reorder_level >= 0)
);

CREATE INDEX IF NOT EXISTS idx_store_inventory_levels_store_id ON public.store_inventory_levels(store_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_levels_item_id ON public.store_inventory_levels(item_id);
CREATE INDEX IF NOT EXISTS idx_store_inventory_levels_store_active ON public.store_inventory_levels(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_store_inventory_levels_store_qty ON public.store_inventory_levels(store_id, quantity_on_hand);

ALTER TABLE public.store_inventory_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to store_inventory_levels" ON public.store_inventory_levels;
CREATE POLICY "Allow all access to store_inventory_levels"
  ON public.store_inventory_levels FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- STEP 2: Populate store_inventory_levels from existing inventory_items
-- ============================================================================
INSERT INTO public.store_inventory_levels (store_id, item_id, quantity_on_hand, unit_cost, reorder_level, is_active)
SELECT store_id, id, quantity_on_hand, unit_cost, reorder_level, is_active
FROM public.inventory_items
WHERE store_id IS NOT NULL
ON CONFLICT (store_id, item_id) DO NOTHING;


-- ============================================================================
-- STEP 3: Deduplicate items across stores (same name → keep earliest-created)
-- ============================================================================
DO $$
DECLARE
  v_dup record;
  v_canonical_id uuid;
  v_duplicate_id uuid;
BEGIN
  -- Find item names that exist in multiple stores
  FOR v_dup IN
    SELECT name, array_agg(id ORDER BY created_at ASC, id ASC) AS item_ids
    FROM public.inventory_items
    WHERE store_id IS NOT NULL
    GROUP BY name
    HAVING COUNT(DISTINCT store_id) > 1
  LOOP
    -- First item (earliest created) is canonical
    v_canonical_id := v_dup.item_ids[1];

    -- Process each duplicate (skip canonical)
    FOR i IN 2..array_length(v_dup.item_ids, 1) LOOP
      v_duplicate_id := v_dup.item_ids[i];

      -- store_inventory_levels: already populated in step 2, re-point item_id
      UPDATE public.store_inventory_levels
        SET item_id = v_canonical_id
        WHERE item_id = v_duplicate_id
        AND NOT EXISTS (
          SELECT 1 FROM public.store_inventory_levels sil
          WHERE sil.store_id = store_inventory_levels.store_id AND sil.item_id = v_canonical_id
        );
      -- Delete any that would conflict (already have canonical entry for that store)
      DELETE FROM public.store_inventory_levels WHERE item_id = v_duplicate_id;

      -- inventory_transaction_items: remap
      UPDATE public.inventory_transaction_items SET item_id = v_canonical_id WHERE item_id = v_duplicate_id;

      -- inventory_purchase_lots: remap
      UPDATE public.inventory_purchase_lots SET item_id = v_canonical_id WHERE item_id = v_duplicate_id;

      -- inventory_distributions: remap
      UPDATE public.inventory_distributions SET item_id = v_canonical_id WHERE item_id = v_duplicate_id;

      -- employee_inventory: merge or remap
      -- First, for rows that would conflict on UNIQUE(employee_id, item_id), merge quantities
      UPDATE public.employee_inventory ei_canonical
        SET quantity_on_hand = ei_canonical.quantity_on_hand + ei_dup.quantity_on_hand,
            total_value = ei_canonical.total_value + ei_dup.total_value,
            updated_at = now()
        FROM public.employee_inventory ei_dup
        WHERE ei_dup.item_id = v_duplicate_id
          AND ei_canonical.item_id = v_canonical_id
          AND ei_canonical.employee_id = ei_dup.employee_id;
      -- Delete merged duplicates
      DELETE FROM public.employee_inventory
        WHERE item_id = v_duplicate_id
        AND employee_id IN (
          SELECT employee_id FROM public.employee_inventory WHERE item_id = v_canonical_id
        );
      -- Remap remaining (no conflict)
      UPDATE public.employee_inventory SET item_id = v_canonical_id WHERE item_id = v_duplicate_id;

      -- employee_inventory_lots: remap
      UPDATE public.employee_inventory_lots SET item_id = v_canonical_id WHERE item_id = v_duplicate_id;

      -- store_product_purchase_units: remap (handle potential conflicts on unique constraint)
      UPDATE public.store_product_purchase_units
        SET item_id = v_canonical_id
        WHERE item_id = v_duplicate_id
        AND NOT EXISTS (
          SELECT 1 FROM public.store_product_purchase_units sppu
          WHERE sppu.store_id = store_product_purchase_units.store_id
            AND sppu.item_id = v_canonical_id
            AND sppu.unit_name = store_product_purchase_units.unit_name
        );
      DELETE FROM public.store_product_purchase_units WHERE item_id = v_duplicate_id;

      -- store_product_preferences: remap (handle potential conflicts)
      UPDATE public.store_product_preferences
        SET item_id = v_canonical_id
        WHERE item_id = v_duplicate_id
        AND NOT EXISTS (
          SELECT 1 FROM public.store_product_preferences spp
          WHERE spp.store_id = store_product_preferences.store_id AND spp.item_id = v_canonical_id
        );
      DELETE FROM public.store_product_preferences WHERE item_id = v_duplicate_id;

      -- Sub-items: remap parent_id references
      UPDATE public.inventory_items SET parent_id = v_canonical_id WHERE parent_id = v_duplicate_id;

      -- Now safe to delete the duplicate item
      DELETE FROM public.inventory_items WHERE id = v_duplicate_id;
    END LOOP;
  END LOOP;
END $$;


-- ============================================================================
-- STEP 4: Alter inventory_items - make store_id nullable, change unique constraint
-- ============================================================================

-- Drop the old per-store unique name constraint
ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_unique_store_name;

-- Make store_id nullable
ALTER TABLE public.inventory_items ALTER COLUMN store_id DROP NOT NULL;

-- Set all store_ids to NULL (items are now global)
UPDATE public.inventory_items SET store_id = NULL;

-- Add global unique name constraint
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_unique_name UNIQUE(name);

-- Drop per-store check constraints that reference deprecated columns
-- (keep them on the table for rollback safety, but they won't fire since columns still exist)


-- ============================================================================
-- STEP 5: Trigger to auto-create store_inventory_levels for new items
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_create_store_inventory_levels()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_inventory_levels (store_id, item_id, quantity_on_hand, unit_cost, reorder_level, is_active)
  SELECT s.id, NEW.id, 0, 0, 0, true
  FROM public.stores s
  WHERE s.active = true
  ON CONFLICT (store_id, item_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_create_store_inventory_levels ON public.inventory_items;
CREATE TRIGGER trigger_auto_create_store_inventory_levels
  AFTER INSERT ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_store_inventory_levels();


-- ============================================================================
-- STEP 6: Update database functions to use store_inventory_levels
-- ============================================================================

-- 6a. update_inventory_on_transaction_approval
-- Now updates store_inventory_levels instead of inventory_items
CREATE OR REPLACE FUNCTION public.update_inventory_on_transaction_approval()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item record;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    FOR v_item IN SELECT item_id, quantity FROM public.inventory_transaction_items WHERE transaction_id = NEW.id
    LOOP
      IF NEW.transaction_type = 'in' THEN
        UPDATE public.store_inventory_levels
          SET quantity_on_hand = quantity_on_hand + v_item.quantity, updated_at = now()
          WHERE store_id = NEW.store_id AND item_id = v_item.item_id;
      ELSE
        UPDATE public.store_inventory_levels
          SET quantity_on_hand = quantity_on_hand - v_item.quantity, updated_at = now()
          WHERE store_id = NEW.store_id AND item_id = v_item.item_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;


-- 6b. create_lots_from_approved_transaction
-- Now gets store_id from the transaction (NEW.store_id) instead of JOINing inventory_items
CREATE OR REPLACE FUNCTION public.create_lots_from_approved_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_transaction_item record;
  v_lot_id uuid;
  v_lot_number text;
  v_item_index int := 0;
BEGIN
  IF NEW.transaction_type = 'in' AND NEW.status = 'approved'
     AND (OLD.status IS NULL OR OLD.status != 'approved') AND NEW.manager_approved = true THEN
    FOR v_transaction_item IN
      SELECT ti.id, ti.item_id, ti.quantity, ti.unit_cost, ti.purchase_unit_id,
             ti.purchase_quantity, ti.purchase_unit_multiplier, ti.notes
      FROM public.inventory_transaction_items ti
      WHERE ti.transaction_id = NEW.id ORDER BY ti.id
    LOOP
      v_lot_number := public.generate_lot_number(NEW.store_id, NULL, v_item_index);
      v_item_index := v_item_index + 1;

      INSERT INTO public.inventory_purchase_lots (
        lot_number, store_id, item_id, supplier_id, quantity_received, quantity_remaining,
        unit_cost, purchase_date, invoice_reference, notes, status, created_by_id
      ) VALUES (
        v_lot_number, NEW.store_id, v_transaction_item.item_id, NEW.supplier_id,
        v_transaction_item.quantity, v_transaction_item.quantity, v_transaction_item.unit_cost,
        NEW.created_at, NEW.invoice_reference,
        CASE WHEN v_transaction_item.purchase_quantity IS NOT NULL THEN
          'Purchased: ' || v_transaction_item.purchase_quantity || ' units at multiplier ' || v_transaction_item.purchase_unit_multiplier || '. ' || COALESCE(v_transaction_item.notes, '')
        ELSE v_transaction_item.notes END,
        'active', NEW.requested_by_id
      ) RETURNING id INTO v_lot_id;

      UPDATE public.inventory_transaction_items SET lot_id = v_lot_id WHERE id = v_transaction_item.id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;


-- 6c. get_low_stock_items
-- Now JOINs store_inventory_levels with inventory_items
CREATE OR REPLACE FUNCTION public.get_low_stock_items(p_store_id uuid)
RETURNS TABLE (item_id uuid, item_code text, item_name text, category text, unit text, quantity_on_hand numeric, reorder_level numeric, quantity_needed numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.name, i.name, i.category, i.unit, sil.quantity_on_hand, sil.reorder_level, sil.reorder_level - sil.quantity_on_hand
  FROM public.store_inventory_levels sil
  JOIN public.inventory_items i ON i.id = sil.item_id
  WHERE sil.store_id = p_store_id AND sil.quantity_on_hand <= sil.reorder_level AND sil.is_active = true
  ORDER BY (sil.reorder_level - sil.quantity_on_hand) DESC, i.name;
END;
$$;


-- 6d. get_store_inventory_with_details
-- Now JOINs store_inventory_levels with inventory_items
CREATE OR REPLACE FUNCTION public.get_store_inventory_with_details(p_store_id uuid)
RETURNS TABLE (stock_id uuid, item_id uuid, code text, name text, description text, category text, unit text, quantity_on_hand numeric, unit_cost numeric, reorder_level numeric, is_low_stock boolean, is_active boolean, last_counted_at timestamptz, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT sil.id, i.id, i.name, i.name, i.description, i.category, i.unit, sil.quantity_on_hand, sil.unit_cost, sil.reorder_level,
         (sil.quantity_on_hand <= sil.reorder_level), sil.is_active, NULL::timestamptz, i.created_at, i.updated_at
  FROM public.store_inventory_levels sil
  JOIN public.inventory_items i ON i.id = sil.item_id
  WHERE sil.store_id = p_store_id AND sil.is_active = true ORDER BY i.name;
END;
$$;


-- 6e. adjust_store_stock
-- Now updates store_inventory_levels instead of inventory_items
CREATE OR REPLACE FUNCTION public.adjust_store_stock(p_store_id uuid, p_item_id uuid, p_quantity_change numeric, p_allow_negative boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_current_quantity numeric;
  v_new_quantity numeric;
BEGIN
  SELECT quantity_on_hand INTO v_current_quantity FROM public.store_inventory_levels WHERE store_id = p_store_id AND item_id = p_item_id;
  IF NOT FOUND THEN v_current_quantity := 0; END IF;
  v_new_quantity := v_current_quantity + p_quantity_change;
  IF v_new_quantity < 0 AND NOT p_allow_negative THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, Requested: %', v_current_quantity, ABS(p_quantity_change);
  END IF;
  UPDATE public.store_inventory_levels SET quantity_on_hand = v_new_quantity, updated_at = now() WHERE store_id = p_store_id AND item_id = p_item_id;
  RETURN true;
END;
$$;


-- 6f. get_master_item_total_quantity
-- Now SUMs from store_inventory_levels
CREATE OR REPLACE FUNCTION public.get_master_item_total_quantity(p_master_item_id uuid, p_store_id uuid)
RETURNS numeric(10,2)
SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(sil.quantity_on_hand), 0)
  FROM public.store_inventory_levels sil
  JOIN public.inventory_items i ON i.id = sil.item_id
  WHERE i.parent_id = p_master_item_id AND sil.is_active = true AND sil.store_id = p_store_id;
$$;


-- 6g. master_item_has_low_stock
-- Now checks store_inventory_levels
CREATE OR REPLACE FUNCTION public.master_item_has_low_stock(p_master_item_id uuid, p_store_id uuid)
RETURNS boolean
SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.store_inventory_levels sil
    JOIN public.inventory_items i ON i.id = sil.item_id
    WHERE i.parent_id = p_master_item_id AND sil.is_active = true AND sil.store_id = p_store_id
      AND sil.quantity_on_hand <= sil.reorder_level
  );
$$;


-- 6h. get_sub_items
-- Now accepts p_store_id parameter and JOINs with store_inventory_levels
-- Returns a table instead of SETOF to include per-store fields
CREATE OR REPLACE FUNCTION public.get_sub_items(p_master_item_id uuid, p_store_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid, store_id uuid, name text, description text, category text, unit text,
  brand text, supplier text, quantity_on_hand numeric, unit_cost numeric,
  reorder_level numeric, is_active boolean, parent_id uuid, is_master_item boolean,
  size text, color_code text, created_at timestamptz, updated_at timestamptz
)
SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
AS $$
  SELECT
    i.id, sil.store_id, i.name, i.description, i.category, i.unit,
    i.brand, i.supplier, COALESCE(sil.quantity_on_hand, 0), COALESCE(sil.unit_cost, 0),
    COALESCE(sil.reorder_level, 0), COALESCE(sil.is_active, true), i.parent_id, i.is_master_item,
    i.size, i.color_code, i.created_at, i.updated_at
  FROM public.inventory_items i
  LEFT JOIN public.store_inventory_levels sil ON sil.item_id = i.id AND (p_store_id IS NULL OR sil.store_id = p_store_id)
  WHERE i.parent_id = p_master_item_id AND (sil.is_active = true OR p_store_id IS NULL)
  ORDER BY i.brand, i.name, i.size, i.color_code;
$$;


-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
