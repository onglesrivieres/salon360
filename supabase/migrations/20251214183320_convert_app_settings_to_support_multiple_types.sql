/*
  # Convert app_settings to Support Multiple Data Types

  1. Schema Changes
    - Change setting_value from boolean to JSONB to support boolean, number, and string
    - Change default_value from boolean to JSONB
    - Migrate existing boolean values to JSONB format
    - Add validation to ensure JSONB values are primitives (not objects/arrays)
    
  2. Data Migration
    - Convert all existing boolean true → JSONB true
    - Convert all existing boolean false → JSONB false
    
  3. Impact
    - Enables numeric settings like auto_approval_minutes
    - Maintains backward compatibility with boolean settings
    - Frontend already expects union type: boolean | string | number
*/

-- Step 1: Add temporary columns for migration
ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS setting_value_new jsonb,
ADD COLUMN IF NOT EXISTS default_value_new jsonb;

-- Step 2: Migrate existing boolean data to JSONB
UPDATE public.app_settings
SET 
  setting_value_new = to_jsonb(setting_value),
  default_value_new = to_jsonb(default_value);

-- Step 3: Drop old columns and rename new ones
ALTER TABLE public.app_settings 
DROP COLUMN setting_value,
DROP COLUMN default_value;

ALTER TABLE public.app_settings 
RENAME COLUMN setting_value_new TO setting_value;

ALTER TABLE public.app_settings 
RENAME COLUMN default_value_new TO default_value;

-- Step 4: Set NOT NULL constraints and defaults
ALTER TABLE public.app_settings 
ALTER COLUMN setting_value SET NOT NULL,
ALTER COLUMN setting_value SET DEFAULT 'false'::jsonb,
ALTER COLUMN default_value SET NOT NULL,
ALTER COLUMN default_value SET DEFAULT 'false'::jsonb;

-- Step 5: Add check constraint to ensure values are primitives (boolean, number, string, null)
ALTER TABLE public.app_settings
ADD CONSTRAINT check_setting_value_is_primitive
CHECK (
  jsonb_typeof(setting_value) IN ('boolean', 'number', 'string', 'null')
);

ALTER TABLE public.app_settings
ADD CONSTRAINT check_default_value_is_primitive
CHECK (
  jsonb_typeof(default_value) IN ('boolean', 'number', 'string', 'null')
);

-- Update the app_settings_audit table similarly
ALTER TABLE public.app_settings_audit
ADD COLUMN IF NOT EXISTS old_value_new jsonb,
ADD COLUMN IF NOT EXISTS new_value_new jsonb;

UPDATE public.app_settings_audit
SET 
  old_value_new = to_jsonb(old_value),
  new_value_new = to_jsonb(new_value);

ALTER TABLE public.app_settings_audit
DROP COLUMN old_value,
DROP COLUMN new_value;

ALTER TABLE public.app_settings_audit
RENAME COLUMN old_value_new TO old_value;

ALTER TABLE public.app_settings_audit
RENAME COLUMN new_value_new TO new_value;

ALTER TABLE public.app_settings_audit
ALTER COLUMN old_value SET NOT NULL,
ALTER COLUMN new_value SET NOT NULL;

-- Add comments
COMMENT ON COLUMN public.app_settings.setting_value IS 
'Current value of the setting. Stored as JSONB to support boolean, number, string, or null values.';

COMMENT ON COLUMN public.app_settings.default_value IS 
'Default value of the setting. Stored as JSONB to support boolean, number, string, or null values.';

COMMENT ON CONSTRAINT check_setting_value_is_primitive ON public.app_settings IS 
'Ensures setting_value is a primitive type (boolean, number, string, null) and not a complex object or array.';
