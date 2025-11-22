/*
  # Add $100 and $50 Bill Denominations to End of Day Records

  ## Overview
  Adds support for tracking $100 and $50 bills in the cash count system.
  This enables complete denomination tracking for all standard US currency bills.

  ## Changes

  1. New Columns Added to end_of_day_records
    - `bill_100` (integer) - Count of $100 bills in opening cash
    - `bill_50` (integer) - Count of $50 bills in opening cash
    - `closing_bill_100` (integer) - Count of $100 bills in closing cash
    - `closing_bill_50` (integer) - Count of $50 bills in closing cash

  2. Updated Functions
    - `check_opening_cash_recorded` - Now checks for $100 and $50 bills when validating opening cash

  3. Default Values
    - All new columns default to 0 for backward compatibility
    - Existing records remain valid with implicit 0 values

  ## Business Logic
  - Opening cash is considered recorded when any bill/coin denomination count > 0 OR opening_cash_amount > 0
  - New denominations are included in this validation
  - High-value bills ($100, $50) improve cash security and audit accuracy

  ## Backward Compatibility
  - Existing records automatically have 0 for new columns
  - No data migration needed
  - No breaking changes to existing functionality
*/

-- Add $100 and $50 bill columns for opening cash
ALTER TABLE end_of_day_records
  ADD COLUMN IF NOT EXISTS bill_100 integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bill_50 integer DEFAULT 0;

-- Add $100 and $50 bill columns for closing cash
ALTER TABLE end_of_day_records
  ADD COLUMN IF NOT EXISTS closing_bill_100 integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closing_bill_50 integer DEFAULT 0;

-- Add comments to document the new columns
COMMENT ON COLUMN end_of_day_records.bill_100 IS 'Count of $100 bills in opening cash';
COMMENT ON COLUMN end_of_day_records.bill_50 IS 'Count of $50 bills in opening cash';
COMMENT ON COLUMN end_of_day_records.closing_bill_100 IS 'Count of $100 bills in closing cash';
COMMENT ON COLUMN end_of_day_records.closing_bill_50 IS 'Count of $50 bills in closing cash';

-- Update the opening cash validation function to include new denominations
CREATE OR REPLACE FUNCTION check_opening_cash_recorded(
  p_store_id uuid,
  p_ticket_date date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record_exists boolean;
BEGIN
  -- Check if an end_of_day_records entry exists for this store and date
  -- with a non-zero opening cash amount or any bill/coin counts
  SELECT EXISTS (
    SELECT 1
    FROM end_of_day_records
    WHERE store_id = p_store_id
      AND date = p_ticket_date
      AND (
        opening_cash_amount > 0
        OR bill_100 > 0
        OR bill_50 > 0
        OR bill_20 > 0
        OR bill_10 > 0
        OR bill_5 > 0
        OR bill_2 > 0
        OR bill_1 > 0
        OR coin_25 > 0
        OR coin_10 > 0
        OR coin_5 > 0
      )
  ) INTO v_record_exists;

  RETURN v_record_exists;
END;
$$;

-- Add helpful comment to the function
COMMENT ON FUNCTION check_opening_cash_recorded(uuid, date) IS
  'Validates if opening cash has been recorded for a store and date, including $100 and $50 bill counts';