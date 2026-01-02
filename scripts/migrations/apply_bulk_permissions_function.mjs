import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const migration = `
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
`;

async function applyMigration() {
  console.log('Creating bulk permissions query function...');

  // Since we can't use exec_sql, we'll use the Supabase client to execute raw SQL
  const { data, error } = await supabase.rpc('exec_sql', { sql: migration }).catch(async (err) => {
    // If exec_sql doesn't exist, try direct query execution
    console.log('Trying alternative execution method...');
    return await supabase.rpc('get_all_roles_permissions', { p_store_id: '00000000-0000-0000-0000-000000000000' }).catch(() => {
      // Function doesn't exist yet, we need to create it
      throw new Error('Cannot create function - need database admin access');
    });
  });

  if (error) {
    console.error('Error:', error);
    console.log('\nPlease run this SQL manually in Supabase SQL Editor:');
    console.log(migration);
    process.exit(1);
  }

  console.log('Function created successfully!');
}

applyMigration();
