/*
  # Add Cloudflare R2 Storage Settings

  ## Overview
  Adds settings for Cloudflare R2 cloud storage configuration as an alternative to Supabase Storage.

  ## New Settings (Category: Storage)
  - storage_provider: Active storage provider (supabase/r2)
  - r2_account_id: Cloudflare Account ID
  - r2_access_key_id: R2 S3 API Access Key ID
  - r2_secret_access_key: R2 S3 API Secret Access Key
  - r2_bucket_name: R2 Bucket Name
  - r2_public_url: Custom domain or R2 public URL for serving images

  ## Security
  - All R2 credential settings marked as is_critical=true for audit logging
*/

-- ============================================================================
-- INSERT STORAGE SETTINGS FOR EXISTING STORES
-- ============================================================================

-- Storage Provider setting
INSERT INTO public.app_settings (
  store_id,
  setting_key,
  setting_value,
  default_value,
  category,
  display_name,
  description,
  is_critical,
  display_order,
  help_text
)
SELECT
  id,
  'storage_provider',
  '"supabase"'::jsonb,
  '"supabase"'::jsonb,
  'Storage',
  'Storage Provider',
  'Where to store uploaded photos and files',
  true,
  1,
  'Choose between Supabase Storage (default) or Cloudflare R2'
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'storage_provider'
);

-- R2 Account ID setting
INSERT INTO public.app_settings (
  store_id,
  setting_key,
  setting_value,
  default_value,
  category,
  display_name,
  description,
  is_critical,
  display_order,
  help_text
)
SELECT
  id,
  'r2_account_id',
  '""'::jsonb,
  '""'::jsonb,
  'Storage',
  'Cloudflare Account ID',
  'Your Cloudflare account ID (found in the R2 dashboard URL)',
  true,
  2,
  'Format: 32-character alphanumeric string'
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'r2_account_id'
);

-- R2 Access Key ID setting
INSERT INTO public.app_settings (
  store_id,
  setting_key,
  setting_value,
  default_value,
  category,
  display_name,
  description,
  is_critical,
  display_order,
  help_text
)
SELECT
  id,
  'r2_access_key_id',
  '""'::jsonb,
  '""'::jsonb,
  'Storage',
  'R2 Access Key ID',
  'S3 API access key ID from your R2 API token',
  true,
  3,
  'Create an API token in Cloudflare R2 settings with read/write permissions'
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'r2_access_key_id'
);

-- R2 Secret Access Key setting
INSERT INTO public.app_settings (
  store_id,
  setting_key,
  setting_value,
  default_value,
  category,
  display_name,
  description,
  is_critical,
  display_order,
  help_text
)
SELECT
  id,
  'r2_secret_access_key',
  '""'::jsonb,
  '""'::jsonb,
  'Storage',
  'R2 Secret Access Key',
  'S3 API secret access key from your R2 API token',
  true,
  4,
  'Keep this secret. It will be stored securely and used server-side only.'
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'r2_secret_access_key'
);

-- R2 Bucket Name setting
INSERT INTO public.app_settings (
  store_id,
  setting_key,
  setting_value,
  default_value,
  category,
  display_name,
  description,
  is_critical,
  display_order,
  help_text
)
SELECT
  id,
  'r2_bucket_name',
  '""'::jsonb,
  '""'::jsonb,
  'Storage',
  'R2 Bucket Name',
  'The name of your R2 bucket',
  true,
  5,
  'Create a bucket in Cloudflare R2 dashboard first'
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'r2_bucket_name'
);

-- R2 Public URL setting
INSERT INTO public.app_settings (
  store_id,
  setting_key,
  setting_value,
  default_value,
  category,
  display_name,
  description,
  is_critical,
  display_order,
  help_text
)
SELECT
  id,
  'r2_public_url',
  '""'::jsonb,
  '""'::jsonb,
  'Storage',
  'R2 Public URL',
  'Public URL for serving files (custom domain or R2 public bucket URL)',
  false,
  6,
  'Example: https://cdn.yourdomain.com or https://pub-xxxx.r2.dev'
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'r2_public_url'
);

-- ============================================================================
-- UPDATE FUNCTION: initialize_store_settings
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

  -- App Name (Branding)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order, help_text)
  VALUES (p_store_id, 'app_name', '"Salon360"', '"Salon360"', 'Branding', 'Application Name', 'The name displayed on the home screen and browser tab', 1, 'Maximum 50 characters')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- App Logo URL (Branding)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order, help_text)
  VALUES (p_store_id, 'app_logo_url', '""', '""', 'Branding', 'Application Logo', 'Logo displayed on the home screen. Leave empty to use default.', 2, 'Recommended size: 200x200 pixels. Supports JPG, PNG, and WebP formats.')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- Storage Provider
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES (p_store_id, 'storage_provider', '"supabase"', '"supabase"', 'Storage', 'Storage Provider', 'Where to store uploaded photos and files', true, 1, 'Choose between Supabase Storage (default) or Cloudflare R2')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- R2 Account ID
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES (p_store_id, 'r2_account_id', '""', '""', 'Storage', 'Cloudflare Account ID', 'Your Cloudflare account ID (found in the R2 dashboard URL)', true, 2, 'Format: 32-character alphanumeric string')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- R2 Access Key ID
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES (p_store_id, 'r2_access_key_id', '""', '""', 'Storage', 'R2 Access Key ID', 'S3 API access key ID from your R2 API token', true, 3, 'Create an API token in Cloudflare R2 settings with read/write permissions')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- R2 Secret Access Key
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES (p_store_id, 'r2_secret_access_key', '""', '""', 'Storage', 'R2 Secret Access Key', 'S3 API secret access key from your R2 API token', true, 4, 'Keep this secret. It will be stored securely and used server-side only.')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- R2 Bucket Name
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES (p_store_id, 'r2_bucket_name', '""', '""', 'Storage', 'R2 Bucket Name', 'The name of your R2 bucket', true, 5, 'Create a bucket in Cloudflare R2 dashboard first')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- R2 Public URL
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES (p_store_id, 'r2_public_url', '""', '""', 'Storage', 'R2 Public URL', 'Public URL for serving files (custom domain or R2 public bucket URL)', false, 6, 'Example: https://cdn.yourdomain.com or https://pub-xxxx.r2.dev')
  ON CONFLICT (store_id, setting_key) DO NOTHING;
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
