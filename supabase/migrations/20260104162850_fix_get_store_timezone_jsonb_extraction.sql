/*
  # Fix get_store_timezone Function - JSONB Text Extraction

  ## Problem
  The get_store_timezone function was using `setting_value::text` which includes
  JSON quotes when converting jsonb to text. This causes timezone strings like
  "America/New_York" (with quotes) to be passed to AT TIME ZONE operator,
  which is invalid and breaks all check-in operations.

  ## Solution
  Replace `setting_value::text` with `setting_value#>>'{}'` to extract the raw
  text value without JSON quotes. This ensures clean timezone identifiers like
  America/New_York (without quotes) are returned.

  ## Impact
  - Fixes check-in/check-out functionality for all employees
  - Properly handles timezone conversions in attendance functions
  - Maintains backward compatibility with existing data
  - No data migration needed
*/

-- Drop and recreate the get_store_timezone function with correct jsonb extraction
CREATE OR REPLACE FUNCTION public.get_store_timezone(p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_timezone text;
BEGIN
  -- Extract jsonb string value without JSON quotes using #>>'{}'
  SELECT setting_value#>>'{}'
  INTO v_timezone
  FROM public.app_settings
  WHERE store_id = p_store_id
    AND setting_key = 'store_timezone';

  -- Return default if not found
  RETURN COALESCE(v_timezone, 'America/New_York');
END;
$$;

COMMENT ON FUNCTION public.get_store_timezone IS
'Returns the configured timezone for a store, defaults to America/New_York if not set. Uses #>>''{}'''' to extract raw text from jsonb without JSON quotes.';
