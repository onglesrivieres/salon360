/*
  # Optimize Role Permissions Loading Performance
  Note: Skips if role_permissions table doesn't exist.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_permissions') THEN
    RAISE NOTICE 'Skipping - role_permissions table does not exist';
    RETURN;
  END IF;

  -- Create optimized composite index for faster permission lookups
  CREATE INDEX IF NOT EXISTS idx_role_permissions_composite
  ON public.role_permissions(store_id, role_name, permission_key);

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'permission_definitions') THEN
    CREATE INDEX IF NOT EXISTS idx_permission_definitions_lookup
    ON public.permission_definitions(permission_key, module_name, display_order);
    ANALYZE public.permission_definitions;
  END IF;

  ANALYZE public.role_permissions;
END $$;
