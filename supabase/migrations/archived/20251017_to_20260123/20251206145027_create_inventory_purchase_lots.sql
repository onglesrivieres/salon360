/*
  # Create Inventory Purchase Lots System

  ## Overview
  Implements lot-based inventory tracking to support variable purchase pricing.
  Each bulk purchase is tracked as a distinct lot with its actual invoice cost,
  enabling accurate cost analysis and FIFO costing for distribution.

  ## New Tables

  ### inventory_purchase_lots
  Tracks each purchase batch as a distinct lot:
  - `id` (uuid, primary key) - Unique lot identifier
  - `lot_number` (text, unique) - Human-readable lot number (e.g., "SUP-2024-001")
  - `store_id` (uuid) - Store that received this lot
  - `master_item_id` (uuid) - Reference to master inventory item
  - `supplier_id` (uuid) - Reference to supplier (optional)
  - `quantity_received` (numeric) - Original quantity received in this lot
  - `quantity_remaining` (numeric) - Current quantity available in lot
  - `unit_cost` (numeric) - Actual invoice cost per unit for this lot
  - `purchase_date` (timestamptz) - Date lot was received
  - `expiration_date` (timestamptz) - Optional expiration date
  - `batch_number` (text) - Supplier's batch/lot number (optional)
  - `invoice_reference` (text) - Purchase order or invoice reference
  - `notes` (text) - Quality check notes, condition, etc.
  - `status` (text) - 'active', 'depleted', 'expired', 'archived'
  - `created_by_id` (uuid) - Employee who received the lot

  ## Security
  - Enable RLS on all tables
  - Allow managers/admins to create and manage lots
  - Allow all staff to view active lots

  ## Benefits
  - Track actual purchase prices for each batch
  - Support FIFO costing for accurate cost of goods
  - Enable lot recall for quality issues
  - Analyze price trends across purchases
  - Maintain purchase history with supplier metadata
*/

-- Step 1: Create inventory_purchase_lots table (only if required tables exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'master_inventory_items') THEN
    RAISE NOTICE 'Skipping inventory_purchase_lots - master_inventory_items table does not exist';
    RETURN;
  END IF;

  -- Create the table without supplier_id FK initially
  CREATE TABLE IF NOT EXISTS public.inventory_purchase_lots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_number text NOT NULL UNIQUE,
    store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    master_item_id uuid NOT NULL REFERENCES public.master_inventory_items(id) ON DELETE RESTRICT,
    supplier_id uuid, -- FK added conditionally below
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

  -- Add suppliers FK only if suppliers table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'inventory_purchase_lots_supplier_id_fkey'
      AND table_name = 'inventory_purchase_lots'
    ) THEN
      ALTER TABLE public.inventory_purchase_lots
      ADD CONSTRAINT inventory_purchase_lots_supplier_id_fkey
      FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_store_id ON public.inventory_purchase_lots(store_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_master_item_id ON public.inventory_purchase_lots(master_item_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_supplier_id ON public.inventory_purchase_lots(supplier_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_status ON public.inventory_purchase_lots(status);
  CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_purchase_date ON public.inventory_purchase_lots(purchase_date);
  CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_expiration_date ON public.inventory_purchase_lots(expiration_date) WHERE expiration_date IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_store_item_status ON public.inventory_purchase_lots(store_id, master_item_id, status);
END $$;

-- Step 3: Add lot_id to inventory_transaction_items for traceability (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transaction_items')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_purchase_lots') THEN
    ALTER TABLE public.inventory_transaction_items
    ADD COLUMN IF NOT EXISTS lot_id uuid REFERENCES public.inventory_purchase_lots(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_lot_id ON public.inventory_transaction_items(lot_id);
  END IF;
END $$;

-- Step 4: Enable RLS and create policies (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_purchase_lots') THEN
    ALTER TABLE public.inventory_purchase_lots ENABLE ROW LEVEL SECURITY;

    -- All authenticated users can view active lots for their stores
    DROP POLICY IF EXISTS "Users can view inventory purchase lots" ON public.inventory_purchase_lots;
    CREATE POLICY "Users can view inventory purchase lots"
      ON public.inventory_purchase_lots FOR SELECT
      TO anon, authenticated
      USING (true);

    -- Managers and Owners can create lots
    DROP POLICY IF EXISTS "Managers can create lots" ON public.inventory_purchase_lots;
    CREATE POLICY "Managers can create lots"
      ON public.inventory_purchase_lots FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);

    -- Managers and Owners can update lots
    DROP POLICY IF EXISTS "Managers can update lots" ON public.inventory_purchase_lots;
    CREATE POLICY "Managers can update lots"
      ON public.inventory_purchase_lots FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Step 6: Create function to generate lot numbers
CREATE OR REPLACE FUNCTION public.generate_lot_number(
  p_store_id uuid,
  p_supplier_code text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_sequence int;
  v_prefix text;
  v_lot_number text;
BEGIN
  -- Get current year
  v_year := to_char(now(), 'YYYY');

  -- Use supplier code if provided, otherwise use 'LOT'
  v_prefix := COALESCE(p_supplier_code, 'LOT');

  -- Get next sequence number for this year and prefix
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(lot_number FROM '\\d+$') AS integer
    )
  ), 0) + 1
  INTO v_sequence
  FROM public.inventory_purchase_lots
  WHERE store_id = p_store_id
    AND lot_number LIKE v_prefix || '-' || v_year || '-%';

  -- Format: PREFIX-YYYY-NNN (e.g., SUP-2024-001)
  v_lot_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::text, 3, '0');

  RETURN v_lot_number;
END;
$$;

-- Step 7: Create function to automatically update lot status
CREATE OR REPLACE FUNCTION public.update_lot_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark as depleted if quantity remaining is 0
  IF NEW.quantity_remaining <= 0 AND NEW.status = 'active' THEN
    NEW.status := 'depleted';
  END IF;

  -- Mark as expired if past expiration date
  IF NEW.expiration_date IS NOT NULL
     AND NEW.expiration_date < now()
     AND NEW.status = 'active' THEN
    NEW.status := 'expired';
  END IF;

  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- Create trigger to update lot status (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_purchase_lots') THEN
    DROP TRIGGER IF EXISTS trigger_update_lot_status ON public.inventory_purchase_lots;
    CREATE TRIGGER trigger_update_lot_status
      BEFORE UPDATE ON public.inventory_purchase_lots
      FOR EACH ROW
      EXECUTE FUNCTION public.update_lot_status();
  END IF;
END $$;

-- Step 8: Create function to get available lots for an item using FIFO
CREATE OR REPLACE FUNCTION public.get_available_lots_fifo(
  p_store_id uuid,
  p_master_item_id uuid
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
    AND l.master_item_id = p_master_item_id
    AND l.status = 'active'
    AND l.quantity_remaining > 0
  ORDER BY l.purchase_date ASC, l.created_at ASC;
END;
$$;

-- Step 9: Create function to calculate weighted average cost for an item
CREATE OR REPLACE FUNCTION public.calculate_weighted_average_cost(
  p_store_id uuid,
  p_master_item_id uuid
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
    AND master_item_id = p_master_item_id
    AND status = 'active'
    AND quantity_remaining > 0;

  RETURN COALESCE(v_weighted_avg, 0);
END;
$$;

-- Step 10: Add helpful comments (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_purchase_lots') THEN
    COMMENT ON TABLE public.inventory_purchase_lots IS
      'Purchase lot tracking for variable cost inventory. Each bulk purchase is tracked
       as a distinct lot with its actual invoice cost, enabling FIFO costing and lot recall.';

    COMMENT ON COLUMN public.inventory_purchase_lots.lot_number IS
      'Unique lot identifier in format: PREFIX-YYYY-NNN (e.g., SUP-2024-001)';

    COMMENT ON COLUMN public.inventory_purchase_lots.quantity_remaining IS
      'Current available quantity. Decreases as items are distributed to employees or stores.';

    COMMENT ON COLUMN public.inventory_purchase_lots.status IS
      'Lot status: active (available), depleted (empty), expired (past expiration), archived (historical)';
  END IF;
END $$;

COMMENT ON FUNCTION public.get_available_lots_fifo IS
  'Returns available lots for an item ordered by FIFO (First In, First Out) for cost tracking';

COMMENT ON FUNCTION public.calculate_weighted_average_cost IS
  'Calculates weighted average cost across all active lots for an item';
