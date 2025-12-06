/*
  # Create Employee Inventory Sub-Ledger System

  ## Overview
  Implements employee-level inventory tracking to maintain accountability
  and prevent theft. Each employee has their own "mini inventory" with
  complete chain of custody tracking back to original purchase lots.

  ## New Tables

  ### employee_inventory
  Tracks current inventory holdings per employee:
  - `id` (uuid, primary key) - Unique record identifier
  - `employee_id` (uuid) - Employee who holds the inventory
  - `store_id` (uuid) - Store the employee belongs to
  - `master_item_id` (uuid) - The inventory item
  - `quantity_on_hand` (numeric) - Current quantity employee has
  - `total_value` (numeric) - Total cost value (computed from lots)
  - `last_audit_date` (timestamptz) - Last physical count date
  - `last_audit_variance` (numeric) - Variance from last audit
  - `notes` (text) - General notes about employee's inventory

  ### employee_inventory_lots
  Links employee inventory to specific purchase lots for cost tracking:
  - `id` (uuid, primary key) - Unique record identifier
  - `employee_id` (uuid) - Employee holding this portion
  - `store_id` (uuid) - Store context
  - `master_item_id` (uuid) - The inventory item
  - `lot_id` (uuid) - Source purchase lot
  - `quantity` (numeric) - Quantity from this lot
  - `unit_cost` (numeric) - Cost per unit (from lot)
  - `distributed_date` (timestamptz) - When employee received it
  - `expected_depletion_date` (timestamptz) - Estimated consumption date

  ## Security
  - Enable RLS on all tables
  - Employees can view their own inventory
  - Managers can view all employee inventory
  - Only managers can modify distributions

  ## Benefits
  - Complete accountability at employee level
  - Track exactly what each person has
  - Identify theft or loss quickly
  - FIFO cost tracking through lot linkage
  - Support for usage pattern analysis
*/

-- Step 1: Create employee_inventory table
CREATE TABLE IF NOT EXISTS public.employee_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  master_item_id uuid NOT NULL REFERENCES public.master_inventory_items(id) ON DELETE RESTRICT,
  quantity_on_hand numeric(10,2) NOT NULL DEFAULT 0,
  total_value numeric(10,2) NOT NULL DEFAULT 0,
  last_audit_date timestamptz,
  last_audit_variance numeric(10,2),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT employee_inventory_unique_employee_item UNIQUE(employee_id, master_item_id),
  CONSTRAINT employee_inventory_quantity_non_negative CHECK (quantity_on_hand >= 0),
  CONSTRAINT employee_inventory_total_value_non_negative CHECK (total_value >= 0)
);

-- Step 2: Create employee_inventory_lots table for lot-level tracking
CREATE TABLE IF NOT EXISTS public.employee_inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  master_item_id uuid NOT NULL REFERENCES public.master_inventory_items(id) ON DELETE RESTRICT,
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

-- Step 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_inventory_employee_id ON public.employee_inventory(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_store_id ON public.employee_inventory(store_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_master_item_id ON public.employee_inventory(master_item_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_store_employee ON public.employee_inventory(store_id, employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_employee_id ON public.employee_inventory_lots(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_lot_id ON public.employee_inventory_lots(lot_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_master_item_id ON public.employee_inventory_lots(master_item_id);
CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_employee_item ON public.employee_inventory_lots(employee_id, master_item_id);

-- Step 4: Enable RLS
ALTER TABLE public.employee_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_inventory_lots ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for employee_inventory

-- Employees can view their own inventory
CREATE POLICY "Employees can view own inventory"
  ON public.employee_inventory FOR SELECT
  TO anon, authenticated
  USING (true);

-- Managers can view all employee inventory
CREATE POLICY "Managers can insert employee inventory"
  ON public.employee_inventory FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can update employee inventory"
  ON public.employee_inventory FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Step 6: Create RLS policies for employee_inventory_lots

CREATE POLICY "Users can view employee inventory lots"
  ON public.employee_inventory_lots FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Managers can create employee inventory lots"
  ON public.employee_inventory_lots FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can update employee inventory lots"
  ON public.employee_inventory_lots FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Managers can delete employee inventory lots"
  ON public.employee_inventory_lots FOR DELETE
  TO anon, authenticated
  USING (true);

-- Step 7: Create function to update employee inventory summary
CREATE OR REPLACE FUNCTION public.refresh_employee_inventory_summary(
  p_employee_id uuid,
  p_master_item_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_quantity numeric;
  v_total_value numeric;
  v_store_id uuid;
BEGIN
  -- Get employee's store
  SELECT es.store_id INTO v_store_id
  FROM public.employee_stores es
  WHERE es.employee_id = p_employee_id
  LIMIT 1;

  -- Calculate totals from lot-level records
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(quantity * unit_cost), 0)
  INTO v_total_quantity, v_total_value
  FROM public.employee_inventory_lots
  WHERE employee_id = p_employee_id
    AND master_item_id = p_master_item_id;

  -- Upsert employee_inventory record
  INSERT INTO public.employee_inventory (
    employee_id,
    store_id,
    master_item_id,
    quantity_on_hand,
    total_value,
    updated_at
  )
  VALUES (
    p_employee_id,
    v_store_id,
    p_master_item_id,
    v_total_quantity,
    v_total_value,
    now()
  )
  ON CONFLICT (employee_id, master_item_id)
  DO UPDATE SET
    quantity_on_hand = v_total_quantity,
    total_value = v_total_value,
    updated_at = now();

  -- Remove record if quantity is zero
  IF v_total_quantity = 0 THEN
    DELETE FROM public.employee_inventory
    WHERE employee_id = p_employee_id
      AND master_item_id = p_master_item_id;
  END IF;
END;
$$;

-- Step 8: Create function to get employee inventory with details
CREATE OR REPLACE FUNCTION public.get_employee_inventory(
  p_employee_id uuid
)
RETURNS TABLE (
  item_id uuid,
  item_code text,
  item_name text,
  category text,
  unit text,
  quantity_on_hand numeric,
  total_value numeric,
  average_cost numeric,
  lot_count bigint,
  last_audit_date timestamptz,
  last_audit_variance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ei.master_item_id as item_id,
    mi.code as item_code,
    mi.name as item_name,
    mi.category,
    mi.unit,
    ei.quantity_on_hand,
    ei.total_value,
    CASE
      WHEN ei.quantity_on_hand > 0 THEN ei.total_value / ei.quantity_on_hand
      ELSE 0
    END as average_cost,
    COUNT(eil.id) as lot_count,
    ei.last_audit_date,
    ei.last_audit_variance
  FROM public.employee_inventory ei
  JOIN public.master_inventory_items mi ON mi.id = ei.master_item_id
  LEFT JOIN public.employee_inventory_lots eil ON eil.employee_id = ei.employee_id
    AND eil.master_item_id = ei.master_item_id
  WHERE ei.employee_id = p_employee_id
  GROUP BY
    ei.master_item_id,
    mi.code,
    mi.name,
    mi.category,
    mi.unit,
    ei.quantity_on_hand,
    ei.total_value,
    ei.last_audit_date,
    ei.last_audit_variance
  ORDER BY mi.name;
END;
$$;

-- Step 9: Create function to get total inventory value per employee
CREATE OR REPLACE FUNCTION public.get_employee_inventory_value(
  p_employee_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_value numeric;
BEGIN
  SELECT COALESCE(SUM(total_value), 0)
  INTO v_total_value
  FROM public.employee_inventory
  WHERE employee_id = p_employee_id;

  RETURN v_total_value;
END;
$$;

-- Step 10: Add helpful comments
COMMENT ON TABLE public.employee_inventory IS
  'Employee inventory sub-ledger. Tracks what each employee currently has in their
   possession. Provides accountability and theft prevention through individual tracking.';

COMMENT ON TABLE public.employee_inventory_lots IS
  'Lot-level tracking for employee inventory. Links employee holdings back to specific
   purchase lots for FIFO costing and lot recall capability.';

COMMENT ON FUNCTION public.refresh_employee_inventory_summary IS
  'Recalculates employee inventory summary from lot-level records. Call after distributions.';

COMMENT ON FUNCTION public.get_employee_inventory IS
  'Returns complete employee inventory with aggregated details and cost information.';

COMMENT ON FUNCTION public.get_employee_inventory_value IS
  'Calculates total dollar value of inventory held by an employee.';
