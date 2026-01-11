-- Add todays_color column to sale_tickets
ALTER TABLE sale_tickets ADD COLUMN IF NOT EXISTS todays_color text DEFAULT '';

-- Add show/hide configuration settings for customer fields
INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
SELECT id, 'show_customer_name_field', 'true', 'Tickets', 'Show Customer Name Field', 'Display customer name input field on tickets', 'true', false, false, 'When enabled, a Customer Name input field will be shown in the Ticket Editor.', 55
FROM stores
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings WHERE setting_key = 'show_customer_name_field' AND store_id = stores.id
);

INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
SELECT id, 'show_customer_phone_field', 'true', 'Tickets', 'Show Customer Phone Field', 'Display customer phone input field on tickets', 'true', false, false, 'When enabled, a Customer Phone input field will be shown in the Ticket Editor.', 65
FROM stores
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings WHERE setting_key = 'show_customer_phone_field' AND store_id = stores.id
);

INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
SELECT id, 'show_todays_color_field', 'true', 'Tickets', 'Show Today''s Color Field', 'Display today''s color input field on tickets', 'true', false, false, 'When enabled, a Today''s Color input field will be shown in the Ticket Editor for recording nail polish or color selections.', 75
FROM stores
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings WHERE setting_key = 'show_todays_color_field' AND store_id = stores.id
);
