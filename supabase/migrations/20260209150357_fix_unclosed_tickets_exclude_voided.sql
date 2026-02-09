/*
  # Fix: Exclude voided tickets from unclosed ticket validation

  The void feature (2026-02-07) sets `voided_at` but leaves `closed_at` NULL.
  The unclosed-ticket trigger (2025-12-09) only checks `closed_at IS NULL`,
  so voided tickets incorrectly block new ticket creation for subsequent days.

  This migration adds `AND voided_at IS NULL` to both functions so voided
  tickets are no longer considered "unclosed".
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
      AND voided_at IS NULL
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
      AND closed_at IS NULL
      AND voided_at IS NULL;

    RAISE EXCEPTION 'Cannot create a new ticket for % because there are unclosed tickets from %. Please close all previous day tickets before creating new ones.',
      NEW.ticket_date,
      v_earliest_unclosed_date
    USING HINT = 'Go to the Tickets page and close all tickets from previous days first.';
  END IF;

  RETURN NEW;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
