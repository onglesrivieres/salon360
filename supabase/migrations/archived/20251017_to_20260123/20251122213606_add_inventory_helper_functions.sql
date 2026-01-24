/*
  # Add Inventory Helper Functions
  
  ## Functions Created
  
  1. upsert_store_stock - Create or update store stock records
  2. get_low_stock_items - Find items below reorder level
  3. get_store_inventory_with_details - Get enriched inventory view
  4. adjust_store_stock - Safely adjust quantities (transactions)
  
  ## Purpose
  
  - Simplify common inventory operations
  - Ensure data consistency
  - Automatic quantity updates on transactions
  - Low stock alerts
*/

-- Function 1: Upsert store stock (create if missing, update if exists)
CREATE OR REPLACE FUNCTION public.upsert_store_stock(
  p_store_id uuid,
  p_item_id uuid,
  p_quantity numeric DEFAULT 0,
  p_cost_override numeric DEFAULT NULL,
  p_reorder_override numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock_id uuid;
BEGIN
  INSERT INTO public.store_inventory_stock (
    store_id, 
    item_id, 
    quantity_on_hand, 
    unit_cost_override, 
    reorder_level_override,
    updated_at
  )
  VALUES (
    p_store_id, 
    p_item_id, 
    p_quantity,
    p_cost_override, 
    p_reorder_override,
    now()
  )
  ON CONFLICT (store_id, item_id) DO UPDATE SET
    quantity_on_hand = public.store_inventory_stock.quantity_on_hand + EXCLUDED.quantity_on_hand,
    unit_cost_override = COALESCE(EXCLUDED.unit_cost_override, public.store_inventory_stock.unit_cost_override),
    reorder_level_override = COALESCE(EXCLUDED.reorder_level_override, public.store_inventory_stock.reorder_level_override),
    updated_at = now()
  RETURNING id INTO v_stock_id;
  
  RETURN v_stock_id;
END;
$$;

-- Function 2: Get low stock items for a store
CREATE OR REPLACE FUNCTION public.get_low_stock_items(p_store_id uuid)
RETURNS TABLE (
  item_id uuid,
  item_code text,
  item_name text,
  category text,
  unit text,
  quantity_on_hand numeric,
  reorder_level numeric,
  quantity_needed numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.item_id,
    m.code,
    m.name,
    m.category,
    m.unit,
    s.quantity_on_hand,
    COALESCE(s.reorder_level_override, m.reorder_level) as reorder_level,
    COALESCE(s.reorder_level_override, m.reorder_level) - s.quantity_on_hand as quantity_needed
  FROM public.store_inventory_stock s
  JOIN public.master_inventory_items m ON m.id = s.item_id
  WHERE s.store_id = p_store_id
    AND s.quantity_on_hand <= COALESCE(s.reorder_level_override, m.reorder_level)
    AND m.is_active = true
  ORDER BY quantity_needed DESC, m.name;
END;
$$;

-- Function 3: Get store inventory with full details (enriched view)
CREATE OR REPLACE FUNCTION public.get_store_inventory_with_details(p_store_id uuid)
RETURNS TABLE (
  stock_id uuid,
  item_id uuid,
  code text,
  name text,
  description text,
  category text,
  unit text,
  quantity_on_hand numeric,
  unit_cost numeric,
  reorder_level numeric,
  is_low_stock boolean,
  is_active boolean,
  last_counted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as stock_id,
    m.id as item_id,
    m.code,
    m.name,
    m.description,
    m.category,
    m.unit,
    s.quantity_on_hand,
    COALESCE(s.unit_cost_override, m.unit_cost) as unit_cost,
    COALESCE(s.reorder_level_override, m.reorder_level) as reorder_level,
    (s.quantity_on_hand <= COALESCE(s.reorder_level_override, m.reorder_level)) as is_low_stock,
    m.is_active,
    s.last_counted_at,
    s.created_at,
    s.updated_at
  FROM public.store_inventory_stock s
  JOIN public.master_inventory_items m ON m.id = s.item_id
  WHERE s.store_id = p_store_id
    AND m.is_active = true
  ORDER BY m.name;
END;
$$;

-- Function 4: Adjust store stock (for transactions - ensures non-negative)
CREATE OR REPLACE FUNCTION public.adjust_store_stock(
  p_store_id uuid,
  p_item_id uuid,
  p_quantity_change numeric,
  p_allow_negative boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_quantity numeric;
  v_new_quantity numeric;
BEGIN
  -- Get current quantity (create record if doesn't exist)
  SELECT quantity_on_hand INTO v_current_quantity
  FROM public.store_inventory_stock
  WHERE store_id = p_store_id AND item_id = p_item_id;
  
  IF NOT FOUND THEN
    -- Create new stock record with 0 quantity
    INSERT INTO public.store_inventory_stock (store_id, item_id, quantity_on_hand)
    VALUES (p_store_id, p_item_id, 0)
    RETURNING quantity_on_hand INTO v_current_quantity;
  END IF;
  
  v_new_quantity := v_current_quantity + p_quantity_change;
  
  -- Check if quantity would go negative
  IF v_new_quantity < 0 AND NOT p_allow_negative THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, Requested: %', v_current_quantity, ABS(p_quantity_change);
  END IF;
  
  -- Update quantity
  UPDATE public.store_inventory_stock
  SET quantity_on_hand = v_new_quantity,
      updated_at = now()
  WHERE store_id = p_store_id AND item_id = p_item_id;
  
  RETURN true;
END;
$$;

-- Function 5: Update transaction approval to use new schema
CREATE OR REPLACE FUNCTION public.update_inventory_on_transaction_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item record;
  v_quantity_change numeric;
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Loop through all items in the transaction
    FOR v_item IN 
      SELECT master_item_id as item_id, quantity, unit_cost
      FROM public.inventory_transaction_items
      WHERE transaction_id = NEW.id
    LOOP
      -- Calculate quantity change based on transaction type
      IF NEW.transaction_type = 'in' THEN
        v_quantity_change := v_item.quantity;  -- Add to stock
      ELSE
        v_quantity_change := -v_item.quantity; -- Subtract from stock
      END IF;
      
      -- Adjust stock using helper function
      PERFORM public.adjust_store_stock(
        NEW.store_id,
        v_item.item_id,
        v_quantity_change,
        false  -- Don't allow negative stock
      );
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trigger_update_inventory_on_approval ON public.inventory_transactions;

-- Create new trigger for transaction approval
CREATE TRIGGER trigger_update_inventory_on_approval
  AFTER UPDATE ON public.inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_inventory_on_transaction_approval();

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Add comments
COMMENT ON FUNCTION public.upsert_store_stock IS 
  'Create or update store stock record. Creates new record if item not in store yet. 
   Adds to existing quantity if record exists. Handles cost/reorder overrides.';

COMMENT ON FUNCTION public.get_low_stock_items IS 
  'Returns items below their reorder level for a specific store.
   Uses reorder_level_override if set, otherwise uses master reorder_level.';

COMMENT ON FUNCTION public.get_store_inventory_with_details IS
  'Returns enriched inventory view with all item details and calculated fields.
   Includes low stock indicator. Joins master items with store stock.';

COMMENT ON FUNCTION public.adjust_store_stock IS
  'Safely adjust store stock quantity. Creates record if missing.
   Prevents negative stock unless explicitly allowed. Used by transactions.';
