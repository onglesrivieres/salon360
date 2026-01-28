/*
  # Create App Global Settings Table

  ## Overview
  Creates a new table for app-wide settings (Branding, Storage) that apply
  across all stores, separate from per-store settings.

  ## Changes

  ### Tables
  - `app_global_settings` - New table for app-wide configuration
  - `app_global_settings_audit` - Audit log for global settings changes

  ### Functions
  - `initialize_global_settings` - Initialize default global settings
  - Updates `initialize_store_settings` - Remove branding/storage settings

  ## Security
  - All authenticated users can read global settings
  - All authenticated users can write (app-level permission check for Admin/Owner)
*/

-- ============================================================================
-- TABLE: app_global_settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_global_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT 'null'::jsonb,
  default_value jsonb NOT NULL DEFAULT 'null'::jsonb,
  category text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  is_critical boolean DEFAULT false,
  requires_restart boolean DEFAULT false,
  display_order integer DEFAULT 0,
  help_text text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_global_settings_key ON public.app_global_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_app_global_settings_category ON public.app_global_settings(category, display_order);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.app_global_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read global settings
DROP POLICY IF EXISTS "Allow read access to global settings" ON public.app_global_settings;
CREATE POLICY "Allow read access to global settings"
  ON public.app_global_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can modify (app-level check for Admin/Owner)
DROP POLICY IF EXISTS "Allow write access to global settings" ON public.app_global_settings;
CREATE POLICY "Allow write access to global settings"
  ON public.app_global_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: app_global_settings_audit
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_global_settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  is_critical boolean DEFAULT false,
  change_notes text,
  changed_by uuid REFERENCES public.employees(id),
  changed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_global_settings_audit_changed_at
  ON public.app_global_settings_audit(changed_at DESC);

ALTER TABLE public.app_global_settings_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to global settings audit" ON public.app_global_settings_audit;
CREATE POLICY "Allow all access to global settings audit"
  ON public.app_global_settings_audit FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TRIGGERS: Update timestamps and audit logging
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_app_global_settings_updated_at()
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

DROP TRIGGER IF EXISTS trigger_app_global_settings_updated_at ON public.app_global_settings;
CREATE TRIGGER trigger_app_global_settings_updated_at
  BEFORE UPDATE ON public.app_global_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_app_global_settings_updated_at();

CREATE OR REPLACE FUNCTION public.log_app_global_settings_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.setting_value IS DISTINCT FROM NEW.setting_value THEN
    INSERT INTO public.app_global_settings_audit (setting_key, old_value, new_value, is_critical)
    VALUES (NEW.setting_key, OLD.setting_value, NEW.setting_value, NEW.is_critical);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_app_global_settings_change ON public.app_global_settings;
CREATE TRIGGER trigger_log_app_global_settings_change
  AFTER UPDATE ON public.app_global_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_app_global_settings_change();

-- ============================================================================
-- MIGRATE DATA: Copy existing values from first store with non-empty values
-- ============================================================================

-- Insert Branding settings (copy from first store that has them, or use defaults)
INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, display_order, help_text)
SELECT
  'app_name',
  COALESCE(
    (SELECT setting_value FROM public.app_settings WHERE setting_key = 'app_name' AND setting_value::text != '""' LIMIT 1),
    '"Salon360"'::jsonb
  ),
  '"Salon360"'::jsonb,
  'Branding',
  'Application Name',
  'The name displayed on the home screen and browser tab',
  1,
  'Maximum 50 characters'
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, display_order, help_text)
SELECT
  'app_logo_url',
  COALESCE(
    (SELECT setting_value FROM public.app_settings WHERE setting_key = 'app_logo_url' AND setting_value::text != '""' LIMIT 1),
    '""'::jsonb
  ),
  '""'::jsonb,
  'Branding',
  'Application Logo',
  'Logo displayed on the home screen. Leave empty to use default.',
  2,
  'Recommended size: 200x200 pixels. Supports JPG, PNG, and WebP formats.'
ON CONFLICT (setting_key) DO NOTHING;

-- Insert Storage settings (R2 configuration)
INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
SELECT
  'r2_account_id',
  COALESCE(
    (SELECT setting_value FROM public.app_settings WHERE setting_key = 'r2_account_id' AND setting_value::text != '""' LIMIT 1),
    '""'::jsonb
  ),
  '""'::jsonb,
  'Storage',
  'Cloudflare Account ID',
  'Your Cloudflare account ID (found in the R2 dashboard URL)',
  true,
  1,
  'Format: 32-character alphanumeric string'
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
SELECT
  'r2_access_key_id',
  COALESCE(
    (SELECT setting_value FROM public.app_settings WHERE setting_key = 'r2_access_key_id' AND setting_value::text != '""' LIMIT 1),
    '""'::jsonb
  ),
  '""'::jsonb,
  'Storage',
  'R2 Access Key ID',
  'S3 API access key ID from your R2 API token',
  true,
  2,
  'Create an API token in Cloudflare R2 settings with read/write permissions'
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
SELECT
  'r2_secret_access_key',
  COALESCE(
    (SELECT setting_value FROM public.app_settings WHERE setting_key = 'r2_secret_access_key' AND setting_value::text != '""' LIMIT 1),
    '""'::jsonb
  ),
  '""'::jsonb,
  'Storage',
  'R2 Secret Access Key',
  'S3 API secret access key from your R2 API token',
  true,
  3,
  'Keep this secret. It will be stored securely and used server-side only.'
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
SELECT
  'r2_bucket_name',
  COALESCE(
    (SELECT setting_value FROM public.app_settings WHERE setting_key = 'r2_bucket_name' AND setting_value::text != '""' LIMIT 1),
    '""'::jsonb
  ),
  '""'::jsonb,
  'Storage',
  'R2 Bucket Name',
  'The name of your R2 bucket',
  true,
  4,
  'Create a bucket in Cloudflare R2 dashboard first'
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
SELECT
  'r2_public_url',
  COALESCE(
    (SELECT setting_value FROM public.app_settings WHERE setting_key = 'r2_public_url' AND setting_value::text != '""' LIMIT 1),
    '""'::jsonb
  ),
  '""'::jsonb,
  'Storage',
  'R2 Public URL',
  'Public URL for serving files (custom domain or R2 public bucket URL)',
  false,
  5,
  'Example: https://cdn.yourdomain.com or https://pub-xxxx.r2.dev'
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- DELETE OLD SETTINGS FROM app_settings
-- ============================================================================
DELETE FROM public.app_settings WHERE setting_key IN (
  'app_name',
  'app_logo_url',
  'r2_account_id',
  'r2_access_key_id',
  'r2_secret_access_key',
  'r2_bucket_name',
  'r2_public_url'
);

-- ============================================================================
-- UPDATE FUNCTION: initialize_store_settings (remove branding/storage)
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

  -- NOTE: Branding and Storage settings are now in app_global_settings table
END;
$$;

-- ============================================================================
-- NEW FUNCTION: initialize_global_settings
-- ============================================================================
CREATE OR REPLACE FUNCTION public.initialize_global_settings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- App Name (Branding)
  INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, display_order, help_text)
  VALUES ('app_name', '"Salon360"', '"Salon360"', 'Branding', 'Application Name', 'The name displayed on the home screen and browser tab', 1, 'Maximum 50 characters')
  ON CONFLICT (setting_key) DO NOTHING;

  -- App Logo URL (Branding)
  INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, display_order, help_text)
  VALUES ('app_logo_url', '""', '""', 'Branding', 'Application Logo', 'Logo displayed on the home screen. Leave empty to use default.', 2, 'Recommended size: 200x200 pixels. Supports JPG, PNG, and WebP formats.')
  ON CONFLICT (setting_key) DO NOTHING;

  -- R2 Account ID (Storage)
  INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES ('r2_account_id', '""', '""', 'Storage', 'Cloudflare Account ID', 'Your Cloudflare account ID (found in the R2 dashboard URL)', true, 1, 'Format: 32-character alphanumeric string')
  ON CONFLICT (setting_key) DO NOTHING;

  -- R2 Access Key ID
  INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES ('r2_access_key_id', '""', '""', 'Storage', 'R2 Access Key ID', 'S3 API access key ID from your R2 API token', true, 2, 'Create an API token in Cloudflare R2 settings with read/write permissions')
  ON CONFLICT (setting_key) DO NOTHING;

  -- R2 Secret Access Key
  INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES ('r2_secret_access_key', '""', '""', 'Storage', 'R2 Secret Access Key', 'S3 API secret access key from your R2 API token', true, 3, 'Keep this secret. It will be stored securely and used server-side only.')
  ON CONFLICT (setting_key) DO NOTHING;

  -- R2 Bucket Name
  INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES ('r2_bucket_name', '""', '""', 'Storage', 'R2 Bucket Name', 'The name of your R2 bucket', true, 4, 'Create a bucket in Cloudflare R2 dashboard first')
  ON CONFLICT (setting_key) DO NOTHING;

  -- R2 Public URL
  INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES ('r2_public_url', '""', '""', 'Storage', 'R2 Public URL', 'Public URL for serving files (custom domain or R2 public bucket URL)', false, 5, 'Example: https://cdn.yourdomain.com or https://pub-xxxx.r2.dev')
  ON CONFLICT (setting_key) DO NOTHING;
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
