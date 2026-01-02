-- Database Functions for Permission Management

-- Function to get all permissions for a role in a store
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
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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

-- Function to update a single permission
CREATE OR REPLACE FUNCTION public.update_role_permission(
  p_store_id uuid,
  p_role_name text,
  p_permission_key text,
  p_is_enabled boolean,
  p_employee_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Check if permission exists
  SELECT EXISTS (
    SELECT 1 FROM public.permission_definitions WHERE permission_key = p_permission_key
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Permission key % does not exist', p_permission_key;
  END IF;

  -- Insert or update permission
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

-- Function to reset permissions to default for a role
CREATE OR REPLACE FUNCTION public.reset_role_permissions_to_default(
  p_store_id uuid,
  p_role_name text,
  p_employee_id uuid
)
RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Delete all custom permissions for this role (reverting to defaults)
  DELETE FROM public.role_permissions
  WHERE store_id = p_store_id AND role_name = p_role_name;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log the reset action
  INSERT INTO public.role_permissions_audit (
    store_id,
    role_name,
    permission_key,
    old_value,
    new_value,
    changed_by,
    change_reason
  ) VALUES (
    p_store_id,
    p_role_name,
    'ALL_PERMISSIONS',
    false,
    true,
    p_employee_id,
    'Reset all permissions to default'
  );

  RETURN v_count;
END;
$$;

-- Function to seed default permissions for a new store
CREATE OR REPLACE FUNCTION public.seed_store_permissions(p_store_id uuid)
RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- No need to insert anything - defaults are handled by the get_role_permissions function
  -- This function exists for potential future use
  RETURN v_count;
END;
$$;

-- Function to get permission change history for a store
CREATE OR REPLACE FUNCTION public.get_permission_audit_log(
  p_store_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  role_name text,
  permission_key text,
  old_value boolean,
  new_value boolean,
  changed_by_name text,
  changed_at timestamptz,
  change_reason text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rpa.id,
    rpa.role_name,
    rpa.permission_key,
    rpa.old_value,
    rpa.new_value,
    e.name as changed_by_name,
    rpa.changed_at,
    rpa.change_reason
  FROM public.role_permissions_audit rpa
  LEFT JOIN public.employees e ON rpa.changed_by = e.id
  WHERE rpa.store_id = p_store_id
  ORDER BY rpa.changed_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to bulk update permissions for a role
CREATE OR REPLACE FUNCTION public.bulk_update_role_permissions(
  p_store_id uuid,
  p_role_name text,
  p_permissions jsonb,
  p_employee_id uuid
)
RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
  v_permission jsonb;
BEGIN
  -- Iterate through permissions array
  FOR v_permission IN SELECT * FROM jsonb_array_elements(p_permissions)
  LOOP
    -- Update each permission
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

-- Function to copy permissions from one role to another
CREATE OR REPLACE FUNCTION public.copy_role_permissions(
  p_store_id uuid,
  p_from_role text,
  p_to_role text,
  p_employee_id uuid
)
RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 0;
  v_perm record;
BEGIN
  -- Copy all permissions from source role to target role
  FOR v_perm IN
    SELECT permission_key, is_enabled
    FROM public.role_permissions
    WHERE store_id = p_store_id AND role_name = p_from_role
  LOOP
    INSERT INTO public.role_permissions (store_id, role_name, permission_key, is_enabled, created_by, updated_by)
    VALUES (p_store_id, p_to_role, v_perm.permission_key, v_perm.is_enabled, p_employee_id, p_employee_id)
    ON CONFLICT (store_id, role_name, permission_key)
    DO UPDATE SET
      is_enabled = v_perm.is_enabled,
      updated_by = p_employee_id,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
