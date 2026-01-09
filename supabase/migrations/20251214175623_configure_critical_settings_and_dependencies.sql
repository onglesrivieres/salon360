/*
  # Configure Critical Settings and Dependencies

  Note: This migration is conditional and only runs if app_settings table exists.
*/

DO $$
BEGIN
  -- Skip if app_settings table doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_settings') THEN
    RAISE NOTICE 'Skipping app_settings configuration - table does not exist';
    RETURN;
  END IF;

  -- Mark critical settings that require confirmation before changing
  UPDATE public.app_settings
  SET
    is_critical = true,
    requires_restart = true,
    help_text = 'When enabled, tickets must be approved by management before payment collection.'
  WHERE setting_key = 'enable_ticket_approval_system';

  UPDATE public.app_settings
  SET
    is_critical = true,
    help_text = 'Automatically checks out all employees at the store''s closing time.'
  WHERE setting_key = 'auto_checkout_employees_at_closing';

  UPDATE public.app_settings
  SET
    is_critical = true,
    help_text = 'Requires managers to count opening cash before any tickets can be created for the day.'
  WHERE setting_key = 'require_opening_cash_count';

  UPDATE public.app_settings
  SET
    is_critical = true,
    requires_restart = true,
    help_text = 'Enables the full inventory management module including stock tracking, distributions, and audits.'
  WHERE setting_key = 'enable_inventory_module';

  UPDATE public.app_settings
  SET
    is_critical = true,
    requires_restart = true,
    help_text = 'Enables automatic real-time updates for data changes across all devices.'
  WHERE setting_key = 'enable_realtime_refresh';

  -- Set up dependencies between settings
  UPDATE public.app_settings
  SET dependencies = '[
    {"key": "auto_approve_after_48_hours", "type": "affects", "label": "Auto-approve after 48 hours"},
    {"key": "admin_review_rejected_tickets", "type": "affects", "label": "Admin review for rejected tickets"}
  ]'::jsonb
  WHERE setting_key = 'enable_ticket_approval_system';

  UPDATE public.app_settings
  SET dependencies = '[
    {"key": "enable_ticket_approval_system", "type": "requires", "label": "Enable ticket approval system"}
  ]'::jsonb
  WHERE setting_key IN ('auto_approve_after_48_hours', 'admin_review_rejected_tickets');

  -- Set display order for logical grouping
  UPDATE public.app_settings SET display_order = 10 WHERE setting_key = 'enable_ticket_approval_system';
  UPDATE public.app_settings SET display_order = 20 WHERE setting_key = 'auto_approve_after_48_hours';
  UPDATE public.app_settings SET display_order = 30 WHERE setting_key = 'admin_review_rejected_tickets';
  UPDATE public.app_settings SET display_order = 40 WHERE setting_key = 'enable_ready_queue';
  UPDATE public.app_settings SET display_order = 50 WHERE setting_key = 'show_queue_button_in_header';

  UPDATE public.app_settings SET display_order = 10 WHERE setting_key = 'require_opening_cash_count';
  UPDATE public.app_settings SET display_order = 20 WHERE setting_key = 'show_opening_cash_missing_banner';
  UPDATE public.app_settings SET display_order = 10 WHERE setting_key = 'auto_checkout_employees_at_closing';
  UPDATE public.app_settings SET display_order = 10 WHERE setting_key = 'enable_realtime_refresh';
  UPDATE public.app_settings SET display_order = 20 WHERE setting_key = 'enable_inventory_module';
END $$;
