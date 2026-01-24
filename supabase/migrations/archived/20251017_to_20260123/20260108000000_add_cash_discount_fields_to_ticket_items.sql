/*
  # Add Cash-Specific Discount Fields to Ticket Items

  1. New Columns
    - `discount_percentage_cash` (numeric) - The discount percentage for cash payments (0-100)
    - `discount_amount_cash` (numeric) - The fixed discount amount for cash payments

  2. Changes
    - Added `discount_percentage_cash` column to `ticket_items` table with default value of 0.00
    - Added `discount_amount_cash` column to `ticket_items` table with default value of 0.00
    - Added check constraint for percentage range (0-100)
    - Added check constraint for non-negative amount

  3. Notes
    - These fields are used only when payment_method is 'Cash'
    - Existing discount_percentage and discount_amount remain for Card/Mixed payments
    - Formula: total_cash_payment = payment_cash - ((payment_cash * discount_percentage_cash / 100) + discount_amount_cash)
*/

-- Add discount_percentage_cash column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_items' AND column_name = 'discount_percentage_cash'
  ) THEN
    ALTER TABLE ticket_items ADD COLUMN discount_percentage_cash numeric DEFAULT 0.00;
  END IF;
END $$;

-- Add discount_amount_cash column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_items' AND column_name = 'discount_amount_cash'
  ) THEN
    ALTER TABLE ticket_items ADD COLUMN discount_amount_cash numeric DEFAULT 0.00;
  END IF;
END $$;

-- Add check constraint for percentage range (0-100)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ticket_items' AND constraint_name = 'discount_percentage_cash_range'
  ) THEN
    ALTER TABLE ticket_items
    ADD CONSTRAINT discount_percentage_cash_range
    CHECK (discount_percentage_cash >= 0 AND discount_percentage_cash <= 100);
  END IF;
END $$;

-- Add check constraint for non-negative amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'ticket_items' AND constraint_name = 'discount_amount_cash_non_negative'
  ) THEN
    ALTER TABLE ticket_items
    ADD CONSTRAINT discount_amount_cash_non_negative
    CHECK (discount_amount_cash >= 0);
  END IF;
END $$;
