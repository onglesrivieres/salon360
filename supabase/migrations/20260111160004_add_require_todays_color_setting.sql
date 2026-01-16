-- Add require_todays_color_on_tickets setting
INSERT INTO public.app_settings
  (store_id, setting_key, setting_value, category, display_name, description,
   default_value, is_critical, requires_restart, help_text, display_order)
SELECT id, 'require_todays_color_on_tickets', to_jsonb(false), 'Tickets',
  'Require Today''s Color',
  'Require today''s color before saving/closing tickets',
  to_jsonb(false), false, false,
  'When enabled, the Today''s Color field must be filled before a ticket can be saved or closed.',
  76
FROM stores
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings
  WHERE setting_key = 'require_todays_color_on_tickets' AND store_id = stores.id
);
