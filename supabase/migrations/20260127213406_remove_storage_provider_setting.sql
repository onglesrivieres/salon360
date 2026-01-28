/*
  # Remove storage_provider Setting

  ## Overview
  Removes the storage_provider setting as the app now uses only Cloudflare R2 for storage.
  Supabase Storage support has been removed.

  ## Changes
  - Delete storage_provider setting from all stores
  - Update initialize_store_settings() to remove storage_provider
*/

-- ============================================================================
-- DELETE STORAGE_PROVIDER SETTING FROM ALL STORES
-- ============================================================================

DELETE FROM public.app_settings WHERE setting_key = 'storage_provider';

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

  -- R2 Account ID (Storage - R2 only, no provider toggle)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES (p_store_id, 'r2_account_id', '""', '""', 'Storage', 'Cloudflare Account ID', 'Your Cloudflare account ID (found in the R2 dashboard URL)', true, 1, 'Format: 32-character alphanumeric string')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- R2 Access Key ID
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES (p_store_id, 'r2_access_key_id', '""', '""', 'Storage', 'R2 Access Key ID', 'S3 API access key ID from your R2 API token', true, 2, 'Create an API token in Cloudflare R2 settings with read/write permissions')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- R2 Secret Access Key
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES (p_store_id, 'r2_secret_access_key', '""', '""', 'Storage', 'R2 Secret Access Key', 'S3 API secret access key from your R2 API token', true, 3, 'Keep this secret. It will be stored securely and used server-side only.')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- R2 Bucket Name
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES (p_store_id, 'r2_bucket_name', '""', '""', 'Storage', 'R2 Bucket Name', 'The name of your R2 bucket', true, 4, 'Create a bucket in Cloudflare R2 dashboard first')
  ON CONFLICT (store_id, setting_key) DO NOTHING;

  -- R2 Public URL
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, is_critical, display_order, help_text)
  VALUES (p_store_id, 'r2_public_url', '""', '""', 'Storage', 'R2 Public URL', 'Public URL for serving files (custom domain or R2 public bucket URL)', false, 5, 'Example: https://cdn.yourdomain.com or https://pub-xxxx.r2.dev')
  ON CONFLICT (store_id, setting_key) DO NOTHING;
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
