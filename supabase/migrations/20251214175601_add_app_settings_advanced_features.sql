/*
  # Enhanced Configuration System with Critical Settings and Dependencies

  1. Schema Enhancements
    - Add `is_critical` boolean to mark sensitive settings requiring confirmation
    - Add `requires_restart` boolean to indicate settings needing app refresh
    - Add `dependencies` JSONB to store related settings and their relationships
    - Add `display_order` integer for UI sorting and grouping
    - Add `help_text` for detailed contextual help

  Note: This migration is conditional and only runs if app_settings table exists.
*/

DO $$
BEGIN
  -- Skip if app_settings table doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    RAISE NOTICE 'Skipping app_settings enhancements - table does not exist';
    RETURN;
  END IF;

  -- Add new columns to app_settings table
  ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS is_critical boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_restart boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS dependencies jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS help_text text DEFAULT '';

  -- Add comments for documentation
  COMMENT ON COLUMN public.app_settings.is_critical IS 'Marks settings that require additional confirmation before changing (e.g., approval system, auto-checkout)';
  COMMENT ON COLUMN public.app_settings.requires_restart IS 'Indicates if changing this setting requires app refresh to take effect';
  COMMENT ON COLUMN public.app_settings.dependencies IS 'Array of related setting keys that depend on or affect this setting. Format: [{"key": "setting_key", "type": "requires|affects|conflicts"}]';
  COMMENT ON COLUMN public.app_settings.display_order IS 'Order for displaying settings within their category (lower numbers appear first)';
  COMMENT ON COLUMN public.app_settings.help_text IS 'Detailed help text explaining what this setting does and its impact';

  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_app_settings_dependencies ON public.app_settings USING gin (dependencies);
  CREATE INDEX IF NOT EXISTS idx_app_settings_category_order ON public.app_settings (store_id, category, display_order);
  CREATE INDEX IF NOT EXISTS idx_app_settings_critical ON public.app_settings (store_id, is_critical) WHERE is_critical = true;

  -- Update audit table if it exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings_audit') THEN
    ALTER TABLE public.app_settings_audit
    ADD COLUMN IF NOT EXISTS is_critical boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS change_notes text;

    COMMENT ON COLUMN public.app_settings_audit.is_critical IS 'Whether this was a critical setting change requiring special attention';
    COMMENT ON COLUMN public.app_settings_audit.change_notes IS 'Additional notes or justification for the change';
  END IF;
END $$;
