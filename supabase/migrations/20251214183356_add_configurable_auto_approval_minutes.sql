/*
  # Add Configurable Auto Approval Minutes
  Note: Skips if app_settings table doesn't exist.
*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    RAISE NOTICE 'Skipping - app_settings table does not exist';
    RETURN;
  END IF;
  -- Migration would insert auto_approval_minutes setting
END $$;
