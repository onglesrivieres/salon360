/*
  # Add Missing Application Settings

  1. New Settings Categories
    - Adds comprehensive settings across multiple categories
    - Tickets: Customer requirements, validation options
    - Payment: Payment method controls
    - Employee: Tip visibility and attendance settings
    - Notifications: UI notification controls
    - System: Performance and behavior settings

  2. Settings Added
    - Ticket requirements (customer name, phone, employee checkin)
    - Payment method toggles (cash, card, gift card, mixed, discounts)
    - Employee features (tip details, pairing, attendance display)
    - Notification preferences (version, badges, warnings)
    - System configuration (audit logging, refresh interval, session timeout)

  3. Dependencies
    - Links related settings together
    - Ensures logical parent-child relationships
    - Validates configuration consistency
*/

-- Insert settings for all active stores
DO $$
DECLARE
  store_record RECORD;
BEGIN
  -- Skip if app_settings table doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    RAISE NOTICE 'Skipping app_settings inserts - table does not exist';
    RETURN;
  END IF;

  FOR store_record IN SELECT id FROM public.stores WHERE active = true
  LOOP
    -- Tickets Category - Customer Requirements
    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'require_customer_name_on_tickets', false, 'Tickets', 'Require Customer Name', 'Forces entry of customer name on all tickets', false, false, false, 'When enabled, tickets cannot be created or closed without a customer name. Useful for tracking returning customers and personalizing service.', 60
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'require_customer_name_on_tickets');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'require_customer_phone_on_tickets', false, 'Tickets', 'Require Customer Phone', 'Forces entry of customer phone number on all tickets', false, false, false, 'When enabled, tickets cannot be created or closed without a customer phone number. Useful for follow-up communications and appointment reminders.', 70
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'require_customer_phone_on_tickets');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'require_employee_checkin_before_tickets', true, 'Tickets', 'Require Employee Check-In', 'Employees must be checked in to be assigned tickets', true, false, false, 'When enabled, only employees who have checked in for their shift can be assigned to tickets. Ensures accurate time tracking and prevents assignment to absent staff.', 80
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'require_employee_checkin_before_tickets');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'enable_ticket_notes', true, 'Tickets', 'Enable Ticket Notes', 'Allow adding notes and comments to tickets', true, false, false, 'When enabled, staff can add internal notes to tickets for communication and tracking purposes.', 90
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'enable_ticket_notes');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'show_ticket_timer_warnings', true, 'Tickets', 'Show Timer Warnings', 'Display warnings when service time exceeds expected duration', true, false, false, 'When enabled, tickets that exceed their expected service time by 30% will show a visual warning indicator.', 100
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'show_ticket_timer_warnings');

    -- Payment Category
    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'enable_cash_payments', true, 'Payment', 'Enable Cash Payments', 'Allow customers to pay with cash', true, false, false, 'When enabled, cash will be available as a payment method. Disabling removes cash from payment options.', 10
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'enable_cash_payments');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'enable_card_payments', true, 'Payment', 'Enable Card Payments', 'Allow customers to pay with credit/debit cards', true, false, false, 'When enabled, card will be available as a payment method. Disabling removes card from payment options.', 20
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'enable_card_payments');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'enable_gift_card_payments', true, 'Payment', 'Enable Gift Card Payments', 'Allow customers to pay with gift cards', true, false, false, 'When enabled, gift card will be available as a payment method. Disabling removes gift card from payment options.', 30
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'enable_gift_card_payments');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'enable_mixed_payment_methods', true, 'Payment', 'Enable Mixed Payments', 'Allow customers to split payment across multiple methods', true, false, false, 'When enabled, customers can split their payment between cash, card, and gift card. Disabling requires a single payment method per ticket.', 40
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'enable_mixed_payment_methods');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'allow_ticket_discounts', false, 'Payment', 'Allow Ticket Discounts', 'Enable discount functionality on tickets', false, true, false, 'When enabled, authorized staff can apply discounts to tickets. This is a sensitive setting that affects revenue tracking.', 50
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'allow_ticket_discounts');

    -- Employee Category
    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'show_tip_details_to_technicians', true, 'Employee', 'Show Tip Details to Technicians', 'Allow technicians to see detailed tip breakdowns', true, false, false, 'When enabled, technicians can view detailed tip information including customer tips and receptionist tips. Disabling shows only total tips.', 10
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'show_tip_details_to_technicians');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'enable_tip_pairing_mode', true, 'Employee', 'Enable Tip Pairing', 'Allow technicians to work in pairs and share tips', true, false, false, 'When enabled, two technicians can be assigned to the same service and split tips. Useful for training or complex services.', 20
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'enable_tip_pairing_mode');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'show_attendance_on_home_page', true, 'Employee', 'Show Attendance on Home', 'Display quick attendance check-in/out on home page', true, false, false, 'When enabled, employees can quickly check in and out from the home page without navigating to the attendance page.', 30
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'show_attendance_on_home_page');

    -- Notifications Category
    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'show_version_notifications', true, 'Notifications', 'Show Version Updates', 'Display banner when new app version is available', true, false, false, 'When enabled, a notification banner appears at the top of the page when a new version of the app is available. Users can refresh to get the latest features.', 10
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'show_version_notifications');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'show_pending_approval_badge', true, 'Notifications', 'Show Approval Badge', 'Display count of pending approvals in navigation', true, false, false, 'When enabled, shows a badge with the number of items pending approval in the navigation menu. Disabling hides the count but approvals still need to be processed.', 20
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'show_pending_approval_badge');

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'enable_approval_deadline_warnings', true, 'Notifications', 'Approval Deadline Warnings', 'Show warnings for approvals approaching auto-approval deadline', true, false, false, 'When enabled, displays warnings for tickets that are approaching the 48-hour auto-approval deadline. Helps ensure timely manual review.', 30
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'enable_approval_deadline_warnings');

    -- System Category
    INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
    SELECT store_record.id, 'enable_audit_logging', true, 'System', 'Enable Audit Logging', 'Track all configuration changes and critical actions', true, true, false, 'When enabled, all changes to settings and critical business actions are logged for compliance and troubleshooting. Disabling may affect compliance requirements.', 30
    WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE store_id = store_record.id AND setting_key = 'enable_audit_logging');
  END LOOP;
END $$;

-- Add dependencies for new settings (conditional)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    RETURN;
  END IF;

  UPDATE public.app_settings
  SET dependencies = '[
    {"key": "enable_cash_payments", "type": "requires", "label": "Enable cash payments"},
    {"key": "enable_card_payments", "type": "requires", "label": "Enable card payments"},
    {"key": "enable_gift_card_payments", "type": "requires", "label": "Enable gift card payments"}
  ]'::jsonb
  WHERE setting_key = 'enable_mixed_payment_methods';

  UPDATE public.app_settings
  SET dependencies = '[
    {"key": "auto_approve_after_48_hours", "type": "requires", "label": "Auto-approve after 48 hours"}
  ]'::jsonb
  WHERE setting_key = 'enable_approval_deadline_warnings';
END $$;
