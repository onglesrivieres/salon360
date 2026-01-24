/*
  # Convert app_settings to Support Multiple Data Types

  Note: This migration is conditional and only runs if app_settings table exists.
*/

DO $$
BEGIN
  -- Skip if app_settings table doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    RAISE NOTICE 'Skipping app_settings conversion - table does not exist';
    RETURN;
  END IF;

  -- Check if already migrated (setting_value is jsonb)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'setting_value' AND data_type = 'jsonb'
  ) THEN
    RAISE NOTICE 'app_settings already has jsonb columns - skipping conversion';
    RETURN;
  END IF;

  -- Add temporary columns for migration
  ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS setting_value_new jsonb,
  ADD COLUMN IF NOT EXISTS default_value_new jsonb;

  -- Migrate existing boolean data to JSONB
  UPDATE public.app_settings
  SET
    setting_value_new = to_jsonb(setting_value),
    default_value_new = to_jsonb(default_value);

  -- Drop old columns and rename new ones
  ALTER TABLE public.app_settings
  DROP COLUMN IF EXISTS setting_value CASCADE,
  DROP COLUMN IF EXISTS default_value CASCADE;

  ALTER TABLE public.app_settings
  RENAME COLUMN setting_value_new TO setting_value;

  ALTER TABLE public.app_settings
  RENAME COLUMN default_value_new TO default_value;

  -- Set NOT NULL constraints and defaults
  ALTER TABLE public.app_settings
  ALTER COLUMN setting_value SET NOT NULL,
  ALTER COLUMN setting_value SET DEFAULT 'false'::jsonb,
  ALTER COLUMN default_value SET NOT NULL,
  ALTER COLUMN default_value SET DEFAULT 'false'::jsonb;

  -- Add check constraints
  ALTER TABLE public.app_settings
  ADD CONSTRAINT check_setting_value_is_primitive
  CHECK (jsonb_typeof(setting_value) IN ('boolean', 'number', 'string', 'null'));

  ALTER TABLE public.app_settings
  ADD CONSTRAINT check_default_value_is_primitive
  CHECK (jsonb_typeof(default_value) IN ('boolean', 'number', 'string', 'null'));

  -- Update audit table if exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings_audit') THEN
    ALTER TABLE public.app_settings_audit
    ADD COLUMN IF NOT EXISTS old_value_new jsonb,
    ADD COLUMN IF NOT EXISTS new_value_new jsonb;

    UPDATE public.app_settings_audit
    SET
      old_value_new = to_jsonb(old_value),
      new_value_new = to_jsonb(new_value);

    ALTER TABLE public.app_settings_audit
    DROP COLUMN IF EXISTS old_value CASCADE,
    DROP COLUMN IF EXISTS new_value CASCADE;

    ALTER TABLE public.app_settings_audit
    RENAME COLUMN old_value_new TO old_value;

    ALTER TABLE public.app_settings_audit
    RENAME COLUMN new_value_new TO new_value;
  END IF;

  RAISE NOTICE 'app_settings conversion completed';
END $$;
