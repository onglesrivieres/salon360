/*
  # Add Payment Fields to Ticket Items

  1. New Columns
    - `payment_cash` (decimal) - Amount paid in cash
    - `payment_card` (decimal) - Amount paid via credit/debit card
    - `payment_gift_card` (decimal) - Amount paid via gift card

  2. Changes
    - Add three new payment tracking columns to ticket_items table
    - Set default values to 0 for all existing records
    - These fields complement existing tip tracking columns

  3. Notes
    - Existing tip columns (tip_customer_cash, tip_customer_card, tip_receptionist) remain unchanged
    - payment_method field at sale_tickets level becomes optional/deprecated
    - New structure allows tracking split payments across multiple payment types
    - Better granularity for accounting and end-of-day reconciliation
*/

-- Add payment tracking columns to ticket_items
ALTER TABLE ticket_items
ADD COLUMN IF NOT EXISTS payment_cash DECIMAL(10,2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS payment_card DECIMAL(10,2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS payment_gift_card DECIMAL(10,2) DEFAULT 0 NOT NULL;

-- Add check constraints to ensure non-negative values
ALTER TABLE ticket_items
ADD CONSTRAINT payment_cash_non_negative CHECK (payment_cash >= 0),
ADD CONSTRAINT payment_card_non_negative CHECK (payment_card >= 0),
ADD CONSTRAINT payment_gift_card_non_negative CHECK (payment_gift_card >= 0);

-- Create index for better query performance on payment fields
CREATE INDEX IF NOT EXISTS idx_ticket_items_payment_gift_card ON ticket_items(payment_gift_card) WHERE payment_gift_card > 0;