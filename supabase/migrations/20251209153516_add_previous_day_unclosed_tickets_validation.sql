/*
  # Prevent New Ticket Creation When Previous Days Have Unclosed Tickets

  1. Business Rule
    - Users cannot create tickets for a new day if there are any unclosed tickets from previous days
    - This ensures proper day-to-day business operations and prevents skipping days with incomplete work
    - Validation is store-specific (only checks unclosed tickets for the same store)

  2. New Functions
    - `check_previous_unclosed_tickets(p_store_id, p_ticket_date)` - Helper function to check for unclosed tickets before a given date
    - `validate_no_previous_unclosed_tickets()` - Trigger function that validates before ticket insert

  3. Changes
    - Adds a BEFORE INSERT trigger on `sale_tickets` table
    - Raises a clear error message directing users to close previous day tickets first

  4. Security
    - Functions use SECURITY DEFINER with explicit search_path for security
    - Validation applies to all users attempting to create tickets

  5. Important Notes
    - Only affects INSERT operations (new ticket creation)
    - Does not affect updates to existing tickets
    - Error message guides users to close previous day tickets before proceeding
*/

-- Helper function to check for unclosed tickets before a given date
CREATE OR REPLACE FUNCTION public.check_previous_unclosed_tickets(
  p_store_id uuid,
  p_ticket_date date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.sale_tickets
    WHERE store_id = p_store_id
      AND ticket_date < p_ticket_date
      AND closed_at IS NULL
    LIMIT 1
  );
END;
$$;

-- Trigger function to validate no previous unclosed tickets exist
CREATE OR REPLACE FUNCTION public.validate_no_previous_unclosed_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_unclosed boolean;
  v_earliest_unclosed_date date;
BEGIN
  -- Check if there are any unclosed tickets before this ticket's date
  v_has_unclosed := public.check_previous_unclosed_tickets(NEW.store_id, NEW.ticket_date);
  
  IF v_has_unclosed THEN
    -- Get the earliest unclosed ticket date for a more helpful error message
    SELECT MIN(ticket_date) INTO v_earliest_unclosed_date
    FROM public.sale_tickets
    WHERE store_id = NEW.store_id
      AND ticket_date < NEW.ticket_date
      AND closed_at IS NULL;
    
    RAISE EXCEPTION 'Cannot create a new ticket for % because there are unclosed tickets from %. Please close all previous day tickets before creating new ones.',
      NEW.ticket_date,
      v_earliest_unclosed_date
    USING HINT = 'Go to the Tickets page and close all tickets from previous days first.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to sale_tickets table
DROP TRIGGER IF EXISTS enforce_no_previous_unclosed_tickets ON public.sale_tickets;

CREATE TRIGGER enforce_no_previous_unclosed_tickets
  BEFORE INSERT ON public.sale_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_no_previous_unclosed_tickets();