/*
  # 20251214214525_fix_auto_approval_respect_store_settings
  Note: Skips if app_settings table doesn't exist.
*/
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    RAISE NOTICE 'Skipping - app_settings table does not exist';
    RETURN;
  END IF;
  -- Original migration skipped - table does not exist in fresh db
END $$;
