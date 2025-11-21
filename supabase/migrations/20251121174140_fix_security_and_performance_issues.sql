/*
  # Fix Security and Performance Issues

  1. Performance Improvements
    - Add missing indexes for foreign keys:
      - `end_of_day_records.updated_by`
      - `ticket_items.completed_by`
    
  2. Index Cleanup
    - Remove unused indexes:
      - `idx_end_of_day_records_created_by` (covered by foreign key index)
      - `idx_ticket_items_payment_gift_card` (not frequently queried)
  
  3. Security Improvements
    - Fix search_path for functions to prevent injection attacks:
      - `check_opening_cash_recorded`
      - `validate_opening_cash_before_ticket`
    - Set to SECURITY DEFINER with explicit schema qualification
  
  4. Notes
    - Foreign key indexes improve join performance
    - Removing unused indexes reduces write overhead
    - Fixed search_path prevents potential security vulnerabilities
*/

-- Add missing foreign key indexes for performance
CREATE INDEX IF NOT EXISTS idx_end_of_day_records_updated_by 
  ON public.end_of_day_records(updated_by);

CREATE INDEX IF NOT EXISTS idx_ticket_items_completed_by 
  ON public.ticket_items(completed_by);

-- Remove unused indexes
DROP INDEX IF EXISTS public.idx_end_of_day_records_created_by;
DROP INDEX IF EXISTS public.idx_ticket_items_payment_gift_card;

-- Fix check_opening_cash_recorded function with secure search_path
DROP FUNCTION IF EXISTS public.check_opening_cash_recorded(uuid, date);

CREATE FUNCTION public.check_opening_cash_recorded(p_store_id uuid, p_ticket_date date)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.end_of_day_records
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

-- Fix validate_opening_cash_before_ticket function with secure search_path
CREATE OR REPLACE FUNCTION public.validate_opening_cash_before_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cash_recorded boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_cash_recorded := public.check_opening_cash_recorded(NEW.store_id, NEW.ticket_date);

    IF NOT v_cash_recorded THEN
      RAISE EXCEPTION 'Opening cash count must be recorded before creating sale tickets. Please go to End of Day page and count the opening cash first.'
        USING HINT = 'Record opening cash in the End of Day page before creating any tickets for this date.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;