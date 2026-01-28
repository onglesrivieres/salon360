/*
  # Add Branding Settings

  ## Overview
  Adds app_name and app_logo_url settings for per-store branding customization.

  ## New Settings
  - app_name: Custom application name (default: "Salon360")
  - app_logo_url: URL to custom logo in storage (default: empty)
*/

-- ============================================================================
-- INSERT BRANDING SETTINGS FOR EXISTING STORES
-- ============================================================================

-- App Name setting
INSERT INTO public.app_settings (
  store_id,
  setting_key,
  setting_value,
  default_value,
  category,
  display_name,
  description,
  display_order,
  help_text
)
SELECT
  id,
  'app_name',
  '"Salon360"'::jsonb,
  '"Salon360"'::jsonb,
  'Branding',
  'Application Name',
  'The name displayed on the home screen and browser tab',
  1,
  'Maximum 50 characters'
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'app_name'
);

-- App Logo URL setting
INSERT INTO public.app_settings (
  store_id,
  setting_key,
  setting_value,
  default_value,
  category,
  display_name,
  description,
  display_order,
  help_text
)
SELECT
  id,
  'app_logo_url',
  '""'::jsonb,
  '""'::jsonb,
  'Branding',
  'Application Logo',
  'Logo displayed on the home screen. Leave empty to use default.',
  2,
  'Recommended size: 200x200 pixels. Supports JPG, PNG, and WebP formats.'
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'app_logo_url'
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
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
