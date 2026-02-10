-- Add app_slogan to global settings
INSERT INTO public.app_global_settings (setting_key, setting_value, default_value, category, display_name, description, display_order, help_text)
VALUES (
  'app_slogan',
  '"Complete salon management system for tracking and reporting"',
  '"Complete salon management system for tracking and reporting"',
  'Branding',
  'Application Slogan',
  'The subtitle displayed below the app name on the home screen',
  3,
  'Maximum 100 characters'
) ON CONFLICT (setting_key) DO NOTHING;
