/*
  # Fix Function Search Paths for Overloaded Functions

  ## Changes
    - Add search_path to overloaded versions of backfill_historical_auto_checkout
    - Add search_path to overloaded versions of preview_historical_auto_checkout
    - The base versions already have search_path set, but the overloaded versions don't
*/

-- Fix backfill_historical_auto_checkout with parameters
ALTER FUNCTION public.backfill_historical_auto_checkout(date, date) 
  SET search_path = public, pg_temp;

-- Fix preview_historical_auto_checkout with parameters
ALTER FUNCTION public.preview_historical_auto_checkout(date, date) 
  SET search_path = public, pg_temp;