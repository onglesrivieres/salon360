/*
  # Add Configurable Timezone Setting

  1. Overview
    - Adds store_timezone setting to app_settings table
    - Allows each store to configure their timezone
    - Defaults to 'America/New_York' (EST/EDT)
    - Marked as critical setting requiring confirmation

  2. Setting Details
    - Category: System
    - Type: string
    - Default: America/New_York
    - Valid values: IANA timezone identifiers
    - Affects: All time-based operations, attendance, reports, auto-checkout

  3. Impact
    - All timestamps are stored in UTC (no change)
    - Display and business logic uses configured timezone
    - Affects check-in/check-out times
    - Affects report generation
    - Affects auto-checkout scheduling
    - Properly handles DST transitions via date-fns-tz
*/

-- Add timezone setting to existing stores
INSERT INTO public.app_settings (
  store_id,
  setting_key,
  setting_value,
  category,
  display_name,
  description,
  default_value,
  is_critical,
  requires_restart,
  dependencies,
  display_order,
  help_text
)
SELECT
  id,
  'store_timezone',
  to_jsonb('America/New_York'::text),
  'System',
  'Store Timezone',
  'Set the timezone for all time-based operations',
  to_jsonb('America/New_York'::text),
  true,
  true,
  '[{"key": "auto_checkout_employees_at_closing", "type": "affects", "label": "Auto-checkout timing"}, {"key": "enable_ticket_approval_system", "type": "affects", "label": "Approval deadlines"}]'::jsonb,
  5,
  'This setting controls which timezone is used for all time-based operations including attendance tracking, report generation, and automatic processes. Changing this will affect how times are displayed throughout the application. All data is stored in UTC, so changing this setting will not affect historical data accuracy. Common US timezones: America/New_York (Eastern), America/Chicago (Central), America/Denver (Mountain), America/Los_Angeles (Pacific), America/Anchorage (Alaska), Pacific/Honolulu (Hawaii).'
FROM public.stores
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings
  WHERE app_settings.store_id = stores.id
  AND app_settings.setting_key = 'store_timezone'
);

-- Create a helper function to get timezone for a store
CREATE OR REPLACE FUNCTION public.get_store_timezone(p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone text;
BEGIN
  SELECT setting_value::text
  INTO v_timezone
  FROM public.app_settings
  WHERE store_id = p_store_id
    AND setting_key = 'store_timezone';

  -- Return default if not found
  RETURN COALESCE(v_timezone, 'America/New_York');
END;
$$;

COMMENT ON FUNCTION public.get_store_timezone IS 'Returns the configured timezone for a store, defaults to America/New_York if not set';

-- Create validation function for timezone settings
CREATE OR REPLACE FUNCTION public.validate_timezone_setting()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only validate if this is the timezone setting
  IF NEW.setting_key = 'store_timezone' THEN
    -- Basic validation - check if it looks like a valid timezone format
    -- Full validation happens on the client side
    IF NEW.setting_value::text !~ '^[A-Za-z]+/[A-Za-z_]+$' THEN
      RAISE EXCEPTION 'Invalid timezone format. Must be a valid IANA timezone identifier (e.g., America/New_York)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to validate timezone setting
DROP TRIGGER IF EXISTS validate_timezone_setting_trigger ON public.app_settings;
CREATE TRIGGER validate_timezone_setting_trigger
  BEFORE INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_timezone_setting();

COMMENT ON TRIGGER validate_timezone_setting_trigger ON public.app_settings IS 'Validates timezone setting format before insert or update';