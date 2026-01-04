/*
  # Fix Trigger Function Search Path

  1. Problem
    - validate_timezone_setting trigger function has mutable search_path
    - This is a security concern
    
  2. Solution
    - Recreate the trigger function with SET search_path = public
    - This ensures stable, secure search_path
    
  3. Note
    - This is a trigger function (returns TRIGGER), not a validation function
*/

-- Drop and recreate the trigger function with secure search_path
DROP FUNCTION IF EXISTS public.validate_timezone_setting() CASCADE;

CREATE OR REPLACE FUNCTION public.validate_timezone_setting()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the setting_key is 'timezone'
  IF NEW.setting_key = 'timezone' THEN
    -- Validate that the value is a valid IANA timezone name
    BEGIN
      PERFORM now() AT TIME ZONE NEW.value;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid timezone value: %. Must be a valid IANA timezone name.', NEW.value;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS validate_timezone_before_insert_update ON public.app_settings;
CREATE TRIGGER validate_timezone_before_insert_update
  BEFORE INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW
  WHEN (NEW.setting_key = 'timezone')
  EXECUTE FUNCTION public.validate_timezone_setting();

COMMENT ON FUNCTION public.validate_timezone_setting IS
'Trigger function to validate timezone settings. Uses secure search_path to prevent injection attacks.';
