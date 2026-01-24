/*
  # Squashed Migration: Inventory System

  ## Overview
  This migration consolidates inventory system migrations for per-store
  inventory management with FIFO lot tracking and employee distribution.

  ## Tables Created
  - inventory_items: Per-store inventory items
  - inventory_transactions: Inventory in/out transactions
  - inventory_transaction_items: Line items for transactions
  - inventory_purchase_lots: FIFO lot tracking
  - employee_inventory: Employee inventory summary
  - employee_inventory_lots: Employee lot assignments
  - inventory_distributions: Distribution records
  - store_product_preferences: Store purchase preferences

  ## Functions Created
  - Lot management: generate_lot_number, get_available_lots_fifo
  - Distribution: distribute_to_employee, return_from_employee
  - Stock management: adjust_store_stock, get_low_stock_items
  - Various helper and trigger functions
*/

-- ============================================================================
-- SEQUENCE: distribution_seq
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS distribution_seq START 1;

-- ============================================================================
-- TABLE: inventory_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'piece',
  brand text,
  supplier text DEFAULT 'Generic',
  quantity_on_hand numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  reorder_level numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  parent_id uuid REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  is_master_item boolean NOT NULL DEFAULT false,
  size text,
  color_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT inventory_items_unique_store_name UNIQUE(store_id, name),
  CONSTRAINT inventory_items_name_not_empty CHECK (name <> ''),
  CONSTRAINT inventory_items_quantity_non_negative CHECK (quantity_on_hand >= 0),
  CONSTRAINT inventory_items_unit_cost_non_negative CHECK (unit_cost >= 0),
  CONSTRAINT inventory_items_reorder_level_non_negative CHECK (reorder_level >= 0),
  CONSTRAINT inventory_items_master_no_parent CHECK (NOT (is_master_item = true AND parent_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_store_id ON public.inventory_items(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_name ON public.inventory_items(store_id, name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(store_id, category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_active ON public.inventory_items(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock ON public.inventory_items(store_id, quantity_on_hand);
CREATE INDEX IF NOT EXISTS idx_inventory_items_parent_id ON public.inventory_items(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_is_master ON public.inventory_items(is_master_item) WHERE is_master_item = true;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to inventory_items" ON public.inventory_items;
CREATE POLICY "Allow all access to inventory_items"
  ON public.inventory_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: inventory_transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('in', 'out')),
  transaction_number text NOT NULL UNIQUE,
  requested_by_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  recipient_id uuid REFERENCES public.employees(id) ON DELETE RESTRICT,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requires_recipient_approval boolean DEFAULT false,
  requires_manager_approval boolean DEFAULT true,
  recipient_approved boolean DEFAULT false,
  recipient_approved_at timestamptz,
  recipient_approved_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  manager_approved boolean DEFAULT false,
  manager_approved_at timestamptz,
  manager_approved_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  rejection_reason text DEFAULT '',
  supplier_id uuid,
  invoice_reference text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_store_id ON public.inventory_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_status ON public.inventory_transactions(status);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_supplier_id ON public.inventory_transactions(supplier_id);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to inventory_transactions" ON public.inventory_transactions;
CREATE POLICY "Allow all access to inventory_transactions"
  ON public.inventory_transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: inventory_purchase_lots (created before transaction_items for FK)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_purchase_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number text NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  supplier_id uuid,
  quantity_received numeric(10,2) NOT NULL,
  quantity_remaining numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  purchase_date timestamptz NOT NULL DEFAULT now(),
  expiration_date timestamptz,
  batch_number text,
  invoice_reference text,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT inventory_purchase_lots_lot_number_not_empty CHECK (lot_number <> ''),
  CONSTRAINT inventory_purchase_lots_quantity_received_positive CHECK (quantity_received > 0),
  CONSTRAINT inventory_purchase_lots_quantity_remaining_non_negative CHECK (quantity_remaining >= 0),
  CONSTRAINT inventory_purchase_lots_quantity_remaining_valid CHECK (quantity_remaining <= quantity_received),
  CONSTRAINT inventory_purchase_lots_unit_cost_non_negative CHECK (unit_cost >= 0),
  CONSTRAINT inventory_purchase_lots_status_valid CHECK (status IN ('active', 'depleted', 'expired', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_store_id ON public.inventory_purchase_lots(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_item_id ON public.inventory_purchase_lots(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_supplier_id ON public.inventory_purchase_lots(supplier_id);
CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_status ON public.inventory_purchase_lots(status);
CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_purchase_date ON public.inventory_purchase_lots(purchase_date);
CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_expiration_date ON public.inventory_purchase_lots(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_store_item_status ON public.inventory_purchase_lots(store_id, item_id, status);

ALTER TABLE public.inventory_purchase_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to inventory_purchase_lots" ON public.inventory_purchase_lots;
CREATE POLICY "Allow all access to inventory_purchase_lots"
  ON public.inventory_purchase_lots FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: inventory_transaction_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.inventory_transactions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) NOT NULL,
  purchase_unit_id uuid,
  purchase_quantity numeric(10,2),
  purchase_unit_price numeric(10,2),
  purchase_unit_multiplier numeric(10,2),
  lot_id uuid REFERENCES public.inventory_purchase_lots(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_transaction ON public.inventory_transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_item_id ON public.inventory_transaction_items(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_lot_id ON public.inventory_transaction_items(lot_id);

ALTER TABLE public.inventory_transaction_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to inventory_transaction_items" ON public.inventory_transaction_items;
CREATE POLICY "Allow all access to inventory_transaction_items"
  ON public.inventory_transaction_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: employee_inventory
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity_on_hand numeric(10,2) NOT NULL DEFAULT 0,
  total_value numeric(10,2) NOT NULL DEFAULT 0,
  last_audit_date timestamptz,
  last_audit_variance numeric(10,2),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT employee_inventory_unique_employee_item UNIQUE(employee_id, item_id),
  CONSTRAINT employee_inventory_quantity_non_negative CHECK (quantity_on_hand >= 0),
  CONSTRAINT employee_inventory_total_value_non_negative CHECK (total_value >= 0)
);

CREATE INDEX IF NOT EXISTS idx_employee_inventory_employee_id ON public.employee_inventory(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_store_id ON public.employee_inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_item_id ON public.employee_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_store_employee ON public.employee_inventory(store_id, employee_id);

ALTER TABLE public.employee_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to employee_inventory" ON public.employee_inventory;
CREATE POLICY "Allow all access to employee_inventory"
  ON public.employee_inventory FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: employee_inventory_lots
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  lot_id uuid NOT NULL REFERENCES public.inventory_purchase_lots(id) ON DELETE RESTRICT,
  quantity numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) NOT NULL,
  distributed_date timestamptz NOT NULL DEFAULT now(),
  expected_depletion_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT employee_inventory_lots_quantity_positive CHECK (quantity > 0),
  CONSTRAINT employee_inventory_lots_unit_cost_non_negative CHECK (unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_employee_id ON public.employee_inventory_lots(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_lot_id ON public.employee_inventory_lots(lot_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_item_id ON public.employee_inventory_lots(item_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_employee_item ON public.employee_inventory_lots(employee_id, item_id);

ALTER TABLE public.employee_inventory_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to employee_inventory_lots" ON public.employee_inventory_lots;
CREATE POLICY "Allow all access to employee_inventory_lots"
  ON public.employee_inventory_lots FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: inventory_distributions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_number text NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  lot_id uuid REFERENCES public.inventory_purchase_lots(id) ON DELETE RESTRICT,
  from_type text NOT NULL DEFAULT 'store' CHECK (from_type IN ('store', 'employee')),
  from_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  to_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  quantity numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  distribution_date timestamptz NOT NULL DEFAULT now(),
  distributed_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  condition_notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_distributions_store_id ON public.inventory_distributions(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_item_id ON public.inventory_distributions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_lot_id ON public.inventory_distributions(lot_id);
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_to_employee ON public.inventory_distributions(to_employee_id);
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_date ON public.inventory_distributions(distribution_date);

ALTER TABLE public.inventory_distributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to inventory_distributions" ON public.inventory_distributions;
CREATE POLICY "Allow all access to inventory_distributions"
  ON public.inventory_distributions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: store_product_preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.store_product_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  last_used_purchase_unit_id uuid,
  last_purchase_cost numeric(10,2),
  last_used_at timestamptz DEFAULT now(),
  updated_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT store_product_preferences_unique UNIQUE(store_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_store_product_preferences_store_id ON public.store_product_preferences(store_id);
CREATE INDEX IF NOT EXISTS idx_store_product_preferences_item_id ON public.store_product_preferences(item_id);

ALTER TABLE public.store_product_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to store_product_preferences" ON public.store_product_preferences;
CREATE POLICY "Allow all access to store_product_preferences"
  ON public.store_product_preferences FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- FUNCTION: generate_inventory_transaction_number
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_inventory_transaction_number(
  p_transaction_type text,
  p_store_id uuid
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_date_str text;
  v_prefix text;
  v_next_num integer;
BEGIN
  v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  v_prefix := CASE
    WHEN p_transaction_type = 'in' THEN 'IN'
    WHEN p_transaction_type = 'out' THEN 'OUT'
    ELSE 'TXN'
  END;

  SELECT COALESCE(MAX(CAST(SUBSTRING(transaction_number FROM '\\d+$') AS INTEGER)), 0) + 1
  INTO v_next_num
  FROM public.inventory_transactions
  WHERE transaction_number LIKE v_prefix || '-' || v_date_str || '-%';

  RETURN v_prefix || '-' || v_date_str || '-' || LPAD(v_next_num::text, 4, '0');
END;
$$;

-- ============================================================================
-- FUNCTION: generate_lot_number
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_lot_number(
  p_store_id uuid,
  p_supplier_code text DEFAULT NULL,
  p_offset int DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_year text;
  v_sequence int;
  v_prefix text;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_prefix := COALESCE(p_supplier_code, 'LOT');

  SELECT COALESCE(MAX(CAST(SUBSTRING(lot_number FROM '\\d+$') AS integer)), 0) + 1 + p_offset
  INTO v_sequence
  FROM public.inventory_purchase_lots
  WHERE store_id = p_store_id AND lot_number LIKE v_prefix || '-' || v_year || '-%';

  RETURN v_prefix || '-' || v_year || '-' || LPAD(v_sequence::text, 3, '0');
END;
$$;

-- ============================================================================
-- FUNCTION: auto_approve_inventory_transaction
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_approve_inventory_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    IF (NOT NEW.requires_manager_approval OR NEW.manager_approved)
       AND (NOT NEW.requires_recipient_approval OR NEW.recipient_approved) THEN
      NEW.status := 'approved';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_approve_inventory ON public.inventory_transactions;
CREATE TRIGGER trg_auto_approve_inventory
  BEFORE UPDATE ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.auto_approve_inventory_transaction();

-- ============================================================================
-- FUNCTION: update_inventory_on_transaction_approval
-- ============================================================================
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
        UPDATE public.inventory_items SET quantity_on_hand = quantity_on_hand + v_item.quantity, updated_at = now() WHERE id = v_item.item_id;
      ELSE
        UPDATE public.inventory_items SET quantity_on_hand = quantity_on_hand - v_item.quantity, updated_at = now() WHERE id = v_item.item_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_inventory_on_approval ON public.inventory_transactions;
CREATE TRIGGER trigger_update_inventory_on_approval
  AFTER UPDATE ON public.inventory_transactions
  FOR EACH ROW WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION public.update_inventory_on_transaction_approval();

-- ============================================================================
-- FUNCTION: update_lot_status
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_lot_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.quantity_remaining <= 0 AND NEW.status = 'active' THEN
    NEW.status := 'depleted';
  END IF;
  IF NEW.expiration_date IS NOT NULL AND NEW.expiration_date < now() AND NEW.status = 'active' THEN
    NEW.status := 'expired';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_lot_status ON public.inventory_purchase_lots;
CREATE TRIGGER trigger_update_lot_status
  BEFORE UPDATE ON public.inventory_purchase_lots
  FOR EACH ROW EXECUTE FUNCTION public.update_lot_status();

-- ============================================================================
-- FUNCTION: create_lots_from_approved_transaction
-- ============================================================================
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
             ti.purchase_quantity, ti.purchase_unit_multiplier, ti.notes, ii.store_id
      FROM public.inventory_transaction_items ti
      JOIN public.inventory_items ii ON ii.id = ti.item_id
      WHERE ti.transaction_id = NEW.id ORDER BY ti.id
    LOOP
      v_lot_number := public.generate_lot_number(v_transaction_item.store_id, NULL, v_item_index);
      v_item_index := v_item_index + 1;

      INSERT INTO public.inventory_purchase_lots (
        lot_number, store_id, item_id, supplier_id, quantity_received, quantity_remaining,
        unit_cost, purchase_date, invoice_reference, notes, status, created_by_id
      ) VALUES (
        v_lot_number, v_transaction_item.store_id, v_transaction_item.item_id, NEW.supplier_id,
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

DROP TRIGGER IF EXISTS trigger_create_lots_from_approved_transaction ON public.inventory_transactions;
CREATE TRIGGER trigger_create_lots_from_approved_transaction
  AFTER UPDATE ON public.inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION public.create_lots_from_approved_transaction();

-- ============================================================================
-- FUNCTION: get_available_lots_fifo
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_available_lots_fifo(p_store_id uuid, p_item_id uuid)
RETURNS TABLE (lot_id uuid, lot_number text, quantity_remaining numeric, unit_cost numeric, purchase_date timestamptz, expiration_date timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.lot_number, l.quantity_remaining, l.unit_cost, l.purchase_date, l.expiration_date
  FROM public.inventory_purchase_lots l
  WHERE l.store_id = p_store_id AND l.item_id = p_item_id AND l.status = 'active' AND l.quantity_remaining > 0
  ORDER BY l.purchase_date ASC, l.created_at ASC;
END;
$$;

-- ============================================================================
-- FUNCTION: calculate_weighted_average_cost
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_weighted_average_cost(p_store_id uuid, p_item_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_weighted_avg numeric;
BEGIN
  SELECT CASE WHEN SUM(quantity_remaining) > 0 THEN SUM(quantity_remaining * unit_cost) / SUM(quantity_remaining) ELSE 0 END
  INTO v_weighted_avg
  FROM public.inventory_purchase_lots
  WHERE store_id = p_store_id AND item_id = p_item_id AND status = 'active' AND quantity_remaining > 0;
  RETURN COALESCE(v_weighted_avg, 0);
END;
$$;

-- ============================================================================
-- FUNCTION: refresh_employee_inventory_summary
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
-- FUNCTION: distribute_to_employee
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

  IF (SELECT COALESCE(SUM(quantity_remaining), 0) FROM public.inventory_purchase_lots
      WHERE store_id = p_store_id AND item_id = p_item_id AND status = 'active' AND quantity_remaining > 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory available';
  END IF;

  FOR v_lot IN
    SELECT id, lot_number, quantity_remaining, unit_cost, purchase_date
    FROM public.inventory_purchase_lots
    WHERE store_id = p_store_id AND item_id = p_item_id AND status = 'active' AND quantity_remaining > 0
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

  RETURN json_build_object('success', true, 'total_quantity', p_quantity, 'distributions', array_to_json(v_distributions));
END;
$$;

-- ============================================================================
-- FUNCTION: return_from_employee
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
BEGIN
  v_remaining_qty := p_quantity;
  IF (SELECT COALESCE(SUM(quantity), 0) FROM public.employee_inventory_lots
      WHERE employee_id = p_employee_id AND item_id = p_item_id) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient employee inventory';
  END IF;

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

  PERFORM public.refresh_employee_inventory_summary(p_employee_id, p_item_id);
  RETURN json_build_object('success', true, 'returned_quantity', p_quantity);
END;
$$;

-- ============================================================================
-- FUNCTION: consume_employee_inventory
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

-- ============================================================================
-- FUNCTION: get_employee_inventory
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_employee_inventory(p_employee_id uuid)
RETURNS TABLE (item_id uuid, item_code text, item_name text, category text, unit text, quantity_on_hand numeric, total_value numeric, average_cost numeric, lot_count bigint, last_audit_date timestamptz, last_audit_variance numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT ei.item_id, i.name, i.name, i.category, i.unit, ei.quantity_on_hand, ei.total_value,
         CASE WHEN ei.quantity_on_hand > 0 THEN ei.total_value / ei.quantity_on_hand ELSE 0 END,
         COUNT(eil.id), ei.last_audit_date, ei.last_audit_variance
  FROM public.employee_inventory ei
  JOIN public.inventory_items i ON i.id = ei.item_id
  LEFT JOIN public.employee_inventory_lots eil ON eil.employee_id = ei.employee_id AND eil.item_id = ei.item_id
  WHERE ei.employee_id = p_employee_id
  GROUP BY ei.item_id, i.name, i.category, i.unit, ei.quantity_on_hand, ei.total_value, ei.last_audit_date, ei.last_audit_variance
  ORDER BY i.name;
END;
$$;

-- ============================================================================
-- FUNCTION: get_employee_inventory_value
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_employee_inventory_value(p_employee_id uuid)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN (SELECT COALESCE(SUM(total_value), 0) FROM public.employee_inventory WHERE employee_id = p_employee_id);
END;
$$;

-- ============================================================================
-- FUNCTION: get_low_stock_items
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_low_stock_items(p_store_id uuid)
RETURNS TABLE (item_id uuid, item_code text, item_name text, category text, unit text, quantity_on_hand numeric, reorder_level numeric, quantity_needed numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.name, i.name, i.category, i.unit, i.quantity_on_hand, i.reorder_level, i.reorder_level - i.quantity_on_hand
  FROM public.inventory_items i
  WHERE i.store_id = p_store_id AND i.quantity_on_hand <= i.reorder_level AND i.is_active = true
  ORDER BY (i.reorder_level - i.quantity_on_hand) DESC, i.name;
END;
$$;

-- ============================================================================
-- FUNCTION: get_store_inventory_with_details
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_store_inventory_with_details(p_store_id uuid)
RETURNS TABLE (stock_id uuid, item_id uuid, code text, name text, description text, category text, unit text, quantity_on_hand numeric, unit_cost numeric, reorder_level numeric, is_low_stock boolean, is_active boolean, last_counted_at timestamptz, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.id, i.name, i.name, i.description, i.category, i.unit, i.quantity_on_hand, i.unit_cost, i.reorder_level,
         (i.quantity_on_hand <= i.reorder_level), i.is_active, NULL::timestamptz, i.created_at, i.updated_at
  FROM public.inventory_items i WHERE i.store_id = p_store_id AND i.is_active = true ORDER BY i.name;
END;
$$;

-- ============================================================================
-- FUNCTION: adjust_store_stock
-- ============================================================================
CREATE OR REPLACE FUNCTION public.adjust_store_stock(p_store_id uuid, p_item_id uuid, p_quantity_change numeric, p_allow_negative boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_current_quantity numeric;
  v_new_quantity numeric;
BEGIN
  SELECT quantity_on_hand INTO v_current_quantity FROM public.inventory_items WHERE store_id = p_store_id AND id = p_item_id;
  IF NOT FOUND THEN v_current_quantity := 0; END IF;
  v_new_quantity := v_current_quantity + p_quantity_change;
  IF v_new_quantity < 0 AND NOT p_allow_negative THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, Requested: %', v_current_quantity, ABS(p_quantity_change);
  END IF;
  UPDATE public.inventory_items SET quantity_on_hand = v_new_quantity, updated_at = now() WHERE store_id = p_store_id AND id = p_item_id;
  RETURN true;
END;
$$;

-- ============================================================================
-- FUNCTION: get_pending_inventory_approvals
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_inventory_approvals(p_employee_id uuid, p_store_id uuid)
RETURNS TABLE (id uuid, transaction_number text, transaction_type text, requested_by_id uuid, requested_by_name text, recipient_id uuid, recipient_name text, notes text, status text, requires_recipient_approval boolean, requires_manager_approval boolean, recipient_approved boolean, manager_approved boolean, created_at timestamptz, item_count bigint, total_value numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_employee_roles text[];
  v_is_manager boolean;
BEGIN
  SELECT e.role INTO v_employee_roles FROM public.employees e WHERE e.id = p_employee_id;
  v_is_manager := 'Manager' = ANY(v_employee_roles) OR 'Owner' = ANY(v_employee_roles);
  RETURN QUERY
  SELECT it.id, it.transaction_number, it.transaction_type, it.requested_by_id, req.display_name,
         it.recipient_id, COALESCE(rec.display_name, ''), it.notes, it.status,
         it.requires_recipient_approval, it.requires_manager_approval, it.recipient_approved, it.manager_approved,
         it.created_at, COUNT(iti.id), SUM(iti.quantity * iti.unit_cost)
  FROM public.inventory_transactions it
  JOIN public.employees req ON req.id = it.requested_by_id
  LEFT JOIN public.employees rec ON rec.id = it.recipient_id
  LEFT JOIN public.inventory_transaction_items iti ON iti.transaction_id = it.id
  WHERE it.store_id = p_store_id AND it.status = 'pending'
    AND ((v_is_manager AND it.requires_manager_approval AND NOT it.manager_approved)
         OR (it.recipient_id = p_employee_id AND it.requires_recipient_approval AND NOT it.recipient_approved))
  GROUP BY it.id, it.transaction_number, it.transaction_type, it.requested_by_id, req.display_name,
           it.recipient_id, rec.display_name, it.notes, it.status, it.requires_recipient_approval,
           it.requires_manager_approval, it.recipient_approved, it.manager_approved, it.created_at
  ORDER BY it.created_at DESC;
END;
$$;

-- ============================================================================
-- FUNCTION: insert_transaction_items_batch
-- ============================================================================
CREATE OR REPLACE FUNCTION public.insert_transaction_items_batch(p_transaction_id uuid, p_items jsonb)
RETURNS TABLE(success boolean, items_inserted integer, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_count integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inventory_transactions WHERE id = p_transaction_id) THEN
    RETURN QUERY SELECT false, 0, 'Transaction not found'::text; RETURN;
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN QUERY SELECT false, 0, 'No items provided'::text; RETURN;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.inventory_transaction_items (
      transaction_id, item_id, quantity, unit_cost, purchase_unit_id, purchase_quantity,
      purchase_unit_price, purchase_unit_multiplier, notes
    ) VALUES (
      p_transaction_id, (v_item->>'item_id')::uuid, (v_item->>'quantity')::numeric, (v_item->>'unit_cost')::numeric,
      NULLIF(v_item->>'purchase_unit_id', '')::uuid, NULLIF(v_item->>'purchase_quantity', '')::numeric,
      NULLIF(v_item->>'purchase_unit_price', '')::numeric, NULLIF(v_item->>'purchase_unit_multiplier', '')::numeric,
      COALESCE(v_item->>'notes', '')
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN QUERY SELECT true, v_count, 'Items inserted successfully'::text;
END;
$$;

-- ============================================================================
-- FUNCTION: update_product_preference
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_product_preference(
  p_store_id uuid, p_item_id uuid, p_purchase_unit_id uuid, p_purchase_cost numeric, p_updated_by_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_product_preferences (store_id, item_id, last_used_purchase_unit_id, last_purchase_cost, last_used_at, updated_by_id)
  VALUES (p_store_id, p_item_id, p_purchase_unit_id, p_purchase_cost, NOW(), p_updated_by_id)
  ON CONFLICT (store_id, item_id) DO UPDATE SET
    last_used_purchase_unit_id = p_purchase_unit_id, last_purchase_cost = p_purchase_cost,
    last_used_at = NOW(), updated_by_id = p_updated_by_id, updated_at = NOW();
END;
$$;

-- ============================================================================
-- FUNCTION: get_sub_items
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_sub_items(p_master_item_id uuid)
RETURNS SETOF public.inventory_items
SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
AS $$
  SELECT * FROM public.inventory_items WHERE parent_id = p_master_item_id AND is_active = true ORDER BY brand, name, size, color_code;
$$;

-- ============================================================================
-- FUNCTION: get_master_item_total_quantity
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_master_item_total_quantity(p_master_item_id uuid, p_store_id uuid)
RETURNS numeric(10,2)
SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(quantity_on_hand), 0) FROM public.inventory_items
  WHERE parent_id = p_master_item_id AND is_active = true AND store_id = p_store_id;
$$;

-- ============================================================================
-- FUNCTION: master_item_has_low_stock
-- ============================================================================
CREATE OR REPLACE FUNCTION public.master_item_has_low_stock(p_master_item_id uuid, p_store_id uuid)
RETURNS boolean
SECURITY DEFINER SET search_path = public LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_items
    WHERE parent_id = p_master_item_id AND is_active = true AND store_id = p_store_id AND quantity_on_hand <= reorder_level
  );
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
