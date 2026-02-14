/*
  # Remove Expiration Date from Inventory Lots

  ## Overview
  The salon does not use expiration dates for inventory lots. This migration removes
  the expiration_date column, the 'expired' lot status, and updates related functions.

  ## Changes

  ### Tables
  - `inventory_purchase_lots` - Drop `expiration_date` column, remove 'expired' from status constraint

  ### Functions
  - `update_lot_status` - Remove expiration check block
  - `get_available_lots_fifo` - Remove expiration_date from RETURNS TABLE and SELECT

  ### Indexes
  - Drop `idx_inventory_purchase_lots_expiration_date`
*/

-- ============================================================================
-- Step 1: Convert any existing 'expired' lots to 'archived'
-- ============================================================================
UPDATE public.inventory_purchase_lots
SET status = 'archived'
WHERE status = 'expired';

-- ============================================================================
-- Step 2: Drop the expiration_date index
-- ============================================================================
DROP INDEX IF EXISTS idx_inventory_purchase_lots_expiration_date;

-- ============================================================================
-- Step 3: Replace status CHECK constraint (remove 'expired')
-- ============================================================================
ALTER TABLE public.inventory_purchase_lots
  DROP CONSTRAINT IF EXISTS inventory_purchase_lots_status_valid;

ALTER TABLE public.inventory_purchase_lots
  ADD CONSTRAINT inventory_purchase_lots_status_valid
  CHECK (status IN ('active', 'depleted', 'archived'));

-- ============================================================================
-- Step 4: Drop the expiration_date column
-- ============================================================================
ALTER TABLE public.inventory_purchase_lots
  DROP COLUMN IF EXISTS expiration_date;

-- ============================================================================
-- Step 5: Replace update_lot_status() — remove expiration check
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_lot_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.quantity_remaining <= 0 AND NEW.status = 'active' THEN
    NEW.status := 'depleted';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Step 6: Replace get_available_lots_fifo() — remove expiration_date
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_available_lots_fifo(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_available_lots_fifo(p_store_id uuid, p_item_id uuid)
RETURNS TABLE (lot_id uuid, lot_number text, quantity_remaining numeric, unit_cost numeric, purchase_date timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.lot_number, l.quantity_remaining, l.unit_cost, l.purchase_date
  FROM public.inventory_purchase_lots l
  WHERE l.store_id = p_store_id AND l.item_id = p_item_id AND l.status = 'active' AND l.quantity_remaining > 0
  ORDER BY l.purchase_date ASC, l.created_at ASC;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
