import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const migration = `
-- Create permission_definitions table
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

-- Create role_permissions table
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
  UNIQUE(store_id, role_name, permission_key)
);

-- Create role_permissions_audit table
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

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_store_role ON public.role_permissions(store_id, role_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_key ON public.role_permissions(permission_key);
CREATE INDEX IF NOT EXISTS idx_role_permissions_audit_store ON public.role_permissions_audit(store_id, changed_at DESC);

-- Add check constraint for valid role names
ALTER TABLE public.role_permissions
DROP CONSTRAINT IF EXISTS valid_role_name;

ALTER TABLE public.role_permissions
ADD CONSTRAINT valid_role_name
CHECK (role_name IN ('Admin', 'Owner', 'Manager', 'Supervisor', 'Receptionist', 'Technician', 'Trainee', 'Cashier'));

-- Enable RLS
ALTER TABLE public.permission_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permission_definitions (read-only for authenticated users)
DROP POLICY IF EXISTS "Anyone can read permission definitions" ON public.permission_definitions;
CREATE POLICY "Anyone can read permission definitions"
  ON public.permission_definitions FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for role_permissions
DROP POLICY IF EXISTS "Users can read role permissions for their stores" ON public.role_permissions;
CREATE POLICY "Users can read role permissions for their stores"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (
    store_id IN (
      SELECT public.employee_stores.store_id
      FROM public.employee_stores
      WHERE public.employee_stores.employee_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin and Owner can insert role permissions" ON public.role_permissions;
CREATE POLICY "Admin and Owner can insert role permissions"
  ON public.role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.employee_stores es ON e.id = es.employee_id
      WHERE e.id = auth.uid()
      AND es.store_id = store_id
      AND (e.role @> ARRAY['Admin'] OR e.role @> ARRAY['Owner'])
    )
  );

DROP POLICY IF EXISTS "Admin and Owner can update role permissions" ON public.role_permissions;
CREATE POLICY "Admin and Owner can update role permissions"
  ON public.role_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.employee_stores es ON e.id = es.employee_id
      WHERE e.id = auth.uid()
      AND es.store_id = store_id
      AND (e.role @> ARRAY['Admin'] OR e.role @> ARRAY['Owner'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      JOIN public.employee_stores es ON e.id = es.employee_id
      WHERE e.id = auth.uid()
      AND es.store_id = store_id
      AND (e.role @> ARRAY['Admin'] OR e.role @> ARRAY['Owner'])
    )
  );

-- RLS Policies for audit log
DROP POLICY IF EXISTS "Users can read audit logs for their stores" ON public.role_permissions_audit;
CREATE POLICY "Users can read audit logs for their stores"
  ON public.role_permissions_audit FOR SELECT
  TO authenticated
  USING (
    store_id IN (
      SELECT public.employee_stores.store_id
      FROM public.employee_stores
      WHERE public.employee_stores.employee_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert audit logs" ON public.role_permissions_audit;
CREATE POLICY "System can insert audit logs"
  ON public.role_permissions_audit FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_role_permissions_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_role_permissions_timestamp ON public.role_permissions;
CREATE TRIGGER trigger_update_role_permissions_timestamp
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_role_permissions_updated_at();

-- Create trigger function to log permission changes
CREATE OR REPLACE FUNCTION public.log_permission_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_enabled != NEW.is_enabled THEN
    INSERT INTO public.role_permissions_audit (
      store_id,
      role_name,
      permission_key,
      old_value,
      new_value,
      changed_by
    ) VALUES (
      NEW.store_id,
      NEW.role_name,
      NEW.permission_key,
      OLD.is_enabled,
      NEW.is_enabled,
      NEW.updated_by
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for audit logging
DROP TRIGGER IF EXISTS trigger_log_permission_changes ON public.role_permissions;
CREATE TRIGGER trigger_log_permission_changes
  AFTER UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_permission_change();
`;

async function applyMigration() {
  console.log('Applying role permissions migration...');

  const { data, error } = await supabase.rpc('exec_sql', { sql: migration });

  if (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }

  console.log('Migration applied successfully!');
}

applyMigration();
