/*
  # Squashed Migration: App Settings

  ## Overview
  This migration consolidates app settings migrations for per-store
  configuration with JSONB value support.

  ## Tables Created
  - app_settings: Per-store configuration settings
  - app_settings_audit: Audit trail for setting changes

  ## Functions Created
  - initialize_store_settings: Set up defaults for new store
*/

-- ============================================================================
-- TABLE: app_settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT 'false'::jsonb,
  default_value jsonb NOT NULL DEFAULT 'false'::jsonb,
  category text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  is_critical boolean DEFAULT false,
  requires_restart boolean DEFAULT false,
  dependencies jsonb DEFAULT '[]'::jsonb,
  display_order integer DEFAULT 0,
  help_text text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_app_settings_store_id ON public.app_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_app_settings_category_order ON public.app_settings(store_id, category, display_order);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to app_settings" ON public.app_settings;
CREATE POLICY "Allow all access to app_settings"
  ON public.app_settings FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: app_settings_audit
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  is_critical boolean DEFAULT false,
  change_notes text,
  changed_by uuid REFERENCES public.employees(id),
  changed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_audit_store ON public.app_settings_audit(store_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_audit_changed_at ON public.app_settings_audit(changed_at DESC);

ALTER TABLE public.app_settings_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to app_settings_audit" ON public.app_settings_audit;
CREATE POLICY "Allow all access to app_settings_audit"
  ON public.app_settings_audit FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FUNCTION: initialize_store_settings
-- ============================================================================
CREATE OR REPLACE FUNCTION public.initialize_store_settings(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Timezone
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description)
  VALUES (p_store_id, 'timezone', '"America/New_York"', '"America/New_York"', 'System', 'Timezone', 'Store timezone for date/time operations')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- Auto-approval minutes
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description)
  VALUES (p_store_id, 'auto_approval_minutes', '2880', '2880', 'Tickets', 'Auto-Approval Minutes', 'Minutes before tickets are auto-approved (default 48 hours)')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- Manager approval minutes
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description)
  VALUES (p_store_id, 'manager_approval_minutes', '2880', '2880', 'Tickets', 'Manager Approval Minutes', 'Minutes before manager-level tickets are auto-approved')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- Small service threshold
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description)
  VALUES (p_store_id, 'small_service_threshold', '30', '30', 'Queue', 'Small Service Threshold', 'Ticket total below this amount is considered a small service')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- Require color for customers
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description)
  VALUES (p_store_id, 'require_todays_color', 'false', 'false', 'Tickets', 'Require Today Color', 'Require color entry for returning customers')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- Customer fields
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description)
  VALUES (p_store_id, 'customer_fields', '{"name": {"required": false, "visible": true}, "phone": {"required": false, "visible": true}}'::jsonb, '{"name": {"required": false, "visible": true}, "phone": {"required": false, "visible": true}}'::jsonb, 'Tickets', 'Customer Fields', 'Customer field visibility and requirements')
  ON CONFLICT (store_id, setting_key) DO NOTHING;
END;
$$;

-- ============================================================================
-- TRIGGER: Update updated_at on settings change
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_app_settings_updated_at()
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

DROP TRIGGER IF EXISTS trigger_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trigger_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_settings_updated_at();

-- ============================================================================
-- TRIGGER: Log settings changes to audit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_app_settings_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.setting_value IS DISTINCT FROM NEW.setting_value THEN
    INSERT INTO public.app_settings_audit (store_id, setting_key, old_value, new_value, is_critical)
    VALUES (NEW.store_id, NEW.setting_key, OLD.setting_value, NEW.setting_value, NEW.is_critical);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_app_settings_change ON public.app_settings;
CREATE TRIGGER trigger_log_app_settings_change
  AFTER UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_app_settings_change();

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
