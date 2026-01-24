-- Fix settings that were incorrectly stored as strings instead of booleans
-- This fixes the issue where 'true' and 'false' were inserted as string literals
-- into JSONB columns, causing Boolean("false") to return true in JavaScript

-- Fix setting_value column
UPDATE public.app_settings
SET setting_value = 'true'::jsonb
WHERE jsonb_typeof(setting_value) = 'string'
  AND setting_value::text = '"true"';

UPDATE public.app_settings
SET setting_value = 'false'::jsonb
WHERE jsonb_typeof(setting_value) = 'string'
  AND setting_value::text = '"false"';

-- Fix default_value column
UPDATE public.app_settings
SET default_value = 'true'::jsonb
WHERE jsonb_typeof(default_value) = 'string'
  AND default_value::text = '"true"';

UPDATE public.app_settings
SET default_value = 'false'::jsonb
WHERE jsonb_typeof(default_value) = 'string'
  AND default_value::text = '"false"';
