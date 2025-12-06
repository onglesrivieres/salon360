/*
  # Add Purchase Unit Price to Inventory Transaction Items

  ## Overview
  Adds a dedicated field to store the actual price paid per purchase unit (e.g., $10 per bottle).
  This provides clearer data entry and more accurate record keeping for purchase transactions.

  ## Changes

  ### Modify Tables
  - `inventory_transaction_items`
    - Add `purchase_unit_price` (numeric) - The price per purchase unit as entered on the invoice

  ## Benefits
  - Preserve exact invoice prices without recalculation
  - Simplify data entry workflow (no confusing toggle between modes)
  - Enable better price trend analysis
  - Improve audit trail for purchase reconciliation

  ## Notes
  - Field is nullable for backward compatibility with existing records
  - Only relevant for "in" type transactions
  - Can be calculated retroactively as: unit_cost × purchase_unit_multiplier
*/

-- Add purchase_unit_price column to track the actual price per purchase unit
ALTER TABLE public.inventory_transaction_items
ADD COLUMN IF NOT EXISTS purchase_unit_price numeric(10,2);

-- Add index for reporting queries on purchase prices
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_purchase_unit_price
  ON public.inventory_transaction_items(purchase_unit_price)
  WHERE purchase_unit_price IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN public.inventory_transaction_items.purchase_unit_price IS
  'The actual price paid per purchase unit (e.g., $10.00 per bottle) as shown on the invoice. Only used for IN transactions.';