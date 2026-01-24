/*
  # Add Store Configuration Functions

  ## Overview
  Creates the missing RPC functions used by ConfigurationPage for checking
  and validating store configuration.

  ## Functions Created
  - store_has_configuration: Check if a store has any settings
  - validate_store_configuration: Validate settings and return issues
*/

-- ============================================================================
-- FUNCTION: store_has_configuration
-- Purpose: Returns true if the store has any settings configured
-- ============================================================================
CREATE OR REPLACE FUNCTION public.store_has_configuration(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_settings WHERE store_id = p_store_id
  );
END;
$$;

-- ============================================================================
-- FUNCTION: validate_store_configuration
-- Purpose: Validates the store configuration and returns any issues
-- Returns: JSONB object with 'issues' array
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_store_configuration(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues jsonb := '[]'::jsonb;
  v_setting record;
BEGIN
  -- Check for critical settings with null/empty values
  FOR v_setting IN
    SELECT setting_key, display_name
    FROM public.app_settings
    WHERE store_id = p_store_id
      AND is_critical = true
      AND (setting_value IS NULL OR setting_value = 'null'::jsonb)
  LOOP
    v_issues := v_issues || jsonb_build_array(
      'Critical setting "' || v_setting.display_name || '" is not configured'
    );
  END LOOP;

  RETURN jsonb_build_object('issues', v_issues);
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
