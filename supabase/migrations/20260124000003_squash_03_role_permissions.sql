/*
  # Squashed Migration: Role Permissions

  ## Overview
  This migration consolidates role permission migrations that establish
  the configurable permission system per store and role.

  ## Tables Created
  - permission_definitions: Global permission catalog
  - role_permissions: Per-store role permission overrides
  - role_permissions_audit: Audit trail for permission changes

  ## Functions Created
  - get_role_permissions: Get permissions for a role
  - update_role_permission: Update single permission
  - get_all_roles_permissions: Get all roles' permissions as JSON
  - bulk_update_role_permissions: Update multiple permissions
*/

-- ============================================================================
-- TABLE: permission_definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.permission_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key text UNIQUE NOT NULL,
  module_name text NOT NULL,
  action_name text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_critical boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permission_definitions_key ON public.permission_definitions(permission_key);
CREATE INDEX IF NOT EXISTS idx_permission_definitions_module ON public.permission_definitions(module_name);

ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to permission_definitions" ON public.permission_definitions;
CREATE POLICY "Allow all access to permission_definitions"
  ON public.permission_definitions FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: role_permissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  permission_key text NOT NULL REFERENCES public.permission_definitions(permission_key) ON DELETE CASCADE,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.employees(id),
  updated_by uuid REFERENCES public.employees(id),
  UNIQUE(store_id, role_name, permission_key),
  CONSTRAINT valid_role_name CHECK (role_name IN ('Admin', 'Owner', 'Manager', 'Supervisor', 'Receptionist', 'Technician', 'Spa Expert', 'Cashier'))
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_store_role ON public.role_permissions(store_id, role_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_key ON public.role_permissions(permission_key);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to role_permissions" ON public.role_permissions;
CREATE POLICY "Allow all access to role_permissions"
  ON public.role_permissions FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: role_permissions_audit
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.role_permissions_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  permission_key text NOT NULL,
  old_value boolean,
  new_value boolean,
  changed_by uuid REFERENCES public.employees(id),
  changed_at timestamptz DEFAULT now(),
  change_reason text
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_audit_store ON public.role_permissions_audit(store_id, changed_at DESC);

ALTER TABLE public.role_permissions_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to role_permissions_audit" ON public.role_permissions_audit;
CREATE POLICY "Allow all access to role_permissions_audit"
  ON public.role_permissions_audit FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FUNCTION: get_role_permissions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_role_permissions(p_store_id uuid, p_role_name text)
RETURNS TABLE (
  permission_key text,
  module_name text,
  action_name text,
  display_name text,
  description text,
  is_critical boolean,
  is_enabled boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pd.permission_key,
    pd.module_name,
    pd.action_name,
    pd.display_name,
    pd.description,
    pd.is_critical,
    COALESCE(rp.is_enabled, true) as is_enabled,
    rp.updated_at
  FROM public.permission_definitions pd
  LEFT JOIN public.role_permissions rp
    ON pd.permission_key = rp.permission_key
    AND rp.store_id = p_store_id
    AND rp.role_name = p_role_name
  ORDER BY pd.module_name, pd.display_order, pd.display_name;
END;
$$;

-- ============================================================================
-- FUNCTION: update_role_permission
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_role_permission(
  p_store_id uuid,
  p_role_name text,
  p_permission_key text,
  p_is_enabled boolean,
  p_employee_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.permission_definitions WHERE permission_key = p_permission_key
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Permission key % does not exist', p_permission_key;
  END IF;

  INSERT INTO public.role_permissions (store_id, role_name, permission_key, is_enabled, created_by, updated_by)
  VALUES (p_store_id, p_role_name, p_permission_key, p_is_enabled, p_employee_id, p_employee_id)
  ON CONFLICT (store_id, role_name, permission_key)
  DO UPDATE SET
    is_enabled = p_is_enabled,
    updated_by = p_employee_id,
    updated_at = now();

  RETURN true;
END;
$$;

-- ============================================================================
-- FUNCTION: get_all_roles_permissions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_all_roles_permissions(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_object_agg(
    role_name,
    permissions
  ) INTO v_result
  FROM (
    SELECT
      roles.role_name,
      jsonb_agg(
        jsonb_build_object(
          'permission_key', pd.permission_key,
          'module_name', pd.module_name,
          'action_name', pd.action_name,
          'display_name', pd.display_name,
          'is_critical', pd.is_critical,
          'is_enabled', COALESCE(rp.is_enabled, true)
        )
        ORDER BY pd.module_name, pd.display_order
      ) as permissions
    FROM (
      SELECT unnest(ARRAY['Admin', 'Owner', 'Manager', 'Supervisor', 'Receptionist', 'Technician', 'Spa Expert', 'Cashier']) as role_name
    ) roles
    CROSS JOIN public.permission_definitions pd
    LEFT JOIN public.role_permissions rp
      ON pd.permission_key = rp.permission_key
      AND rp.store_id = p_store_id
      AND rp.role_name = roles.role_name
    GROUP BY roles.role_name
  ) role_perms;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ============================================================================
-- FUNCTION: bulk_update_role_permissions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bulk_update_role_permissions(
  p_store_id uuid,
  p_role_name text,
  p_permissions jsonb,
  p_employee_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_permission jsonb;
BEGIN
  FOR v_permission IN SELECT * FROM jsonb_array_elements(p_permissions)
  LOOP
    PERFORM public.update_role_permission(
      p_store_id,
      p_role_name,
      v_permission->>'permission_key',
      (v_permission->>'is_enabled')::boolean,
      p_employee_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_role_permissions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_role_permissions_timestamp ON public.role_permissions;
CREATE TRIGGER trigger_update_role_permissions_timestamp
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_role_permissions_updated_at();

-- Log permission changes
CREATE OR REPLACE FUNCTION public.log_permission_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_enabled IS DISTINCT FROM NEW.is_enabled THEN
    INSERT INTO public.role_permissions_audit (store_id, role_name, permission_key, old_value, new_value, changed_by)
    VALUES (NEW.store_id, NEW.role_name, NEW.permission_key, OLD.is_enabled, NEW.is_enabled, NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_permission_changes ON public.role_permissions;
CREATE TRIGGER trigger_log_permission_changes
  AFTER UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_permission_change();

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
