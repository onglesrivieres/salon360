/*
  # Add Bulk Role Permissions Query Function

  1. New Function
    - `get_all_roles_permissions` - Fetches permissions for all roles in a single optimized query

  2. Changes
    - Returns JSONB object with all role permissions grouped by role name
    - Uses JSONB aggregation to minimize data transfer
    - Leverages existing indexes for optimal performance
    - Reduces 8 RPC calls to 1 RPC call for ~87.5% performance improvement

  3. Performance Benefits
    - Single database query instead of 8 separate queries
    - Single network round trip instead of 8
    - Reduced client-side data processing overhead
*/

-- Function to get permissions for all roles in a store in a single query
CREATE OR REPLACE FUNCTION public.get_all_roles_permissions(p_store_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Build a JSONB object with all roles and their permissions
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
          'description', pd.description,
          'is_critical', pd.is_critical,
          'is_enabled', COALESCE(rp.is_enabled, true),
          'updated_at', rp.updated_at
        )
        ORDER BY pd.module_name, pd.display_order, pd.display_name
      ) as permissions
    FROM (
      -- Generate all roles
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
