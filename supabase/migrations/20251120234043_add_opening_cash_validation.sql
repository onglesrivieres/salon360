/*
  # Add Opening Cash Validation for Sale Tickets

  ## Overview
  Enforces that opening cash count must be recorded before any sale tickets can be created for a given store and date.

  ## Changes
  
  1. New Functions
    - `check_opening_cash_recorded` - Validates if opening cash has been recorded for a store and date
    - `validate_opening_cash_before_ticket` - Trigger function to prevent ticket creation without opening cash
  
  2. New Trigger
    - `ensure_opening_cash_before_ticket` - Fires before INSERT on sale_tickets to validate opening cash exists
  
  3. Security
    - Functions are marked as SECURITY DEFINER to allow proper validation
    - Maintains existing RLS policies
  
  ## Business Logic
  - Opening cash is considered recorded when:
    1. A record exists in end_of_day_records for the store and date
    2. The opening_cash_amount is greater than 0 OR any bill/coin count is greater than 0
  - This validation only applies to new ticket creation (INSERT), not updates
  - Provides clear error message directing users to record opening cash first
*/

-- Function to check if opening cash has been recorded for a store and date
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

-- Trigger function to validate opening cash before ticket creation
CREATE OR REPLACE FUNCTION validate_opening_cash_before_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cash_recorded boolean;
BEGIN
  -- Only validate for new tickets, not updates
  IF TG_OP = 'INSERT' THEN
    -- Check if opening cash has been recorded for this store and date
    v_cash_recorded := check_opening_cash_recorded(NEW.store_id, NEW.ticket_date);
    
    IF NOT v_cash_recorded THEN
      RAISE EXCEPTION 'Opening cash count must be recorded before creating sale tickets. Please go to End of Day page and count the opening cash first.'
        USING HINT = 'Record opening cash in the End of Day page before creating any tickets for this date.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on sale_tickets table
DROP TRIGGER IF EXISTS ensure_opening_cash_before_ticket ON sale_tickets;

CREATE TRIGGER ensure_opening_cash_before_ticket
  BEFORE INSERT ON sale_tickets
  FOR EACH ROW
  EXECUTE FUNCTION validate_opening_cash_before_ticket();

-- Add helpful comment to the trigger
COMMENT ON TRIGGER ensure_opening_cash_before_ticket ON sale_tickets IS 
  'Ensures opening cash count is recorded in end_of_day_records before any sale tickets can be created for that store and date';
