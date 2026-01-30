/*
  # Fix: Add updated_at to get_all_roles_permissions

  ## Problem
  The get_all_roles_permissions function did not include the updated_at field
  in its JSONB response. This prevented the frontend from correctly determining
  whether a permission was explicitly set (modified) vs. using the default value.

  ## Fix
  Add 'updated_at', rp.updated_at to the jsonb_build_object call.
*/

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
          'is_enabled', COALESCE(rp.is_enabled, true),
          'updated_at', rp.updated_at
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

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
