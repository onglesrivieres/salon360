/*
  # Update Store Initialization to Include Auto-Approval Minutes

  1. Changes Made
    - Update initialize_store_settings function to include auto_approval_minutes
    - Add the setting to the "recommended" and "full" presets
    - Position it right after auto_approve_after_48_hours setting
*/

CREATE OR REPLACE FUNCTION public.initialize_store_settings(
  p_store_id uuid,
  p_preset text DEFAULT 'recommended' -- 'minimal', 'recommended', 'full'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_result jsonb;
BEGIN
  -- Check if settings already exist
  IF public.store_has_configuration(p_store_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Store already has configuration',
      'settings_count', (SELECT count(*) FROM public.app_settings WHERE store_id = p_store_id)
    );
  END IF;

  -- Verify store exists
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Store does not exist'
    );
  END IF;

  -- Create essential settings (always included)
  INSERT INTO public.app_settings (
    store_id, setting_key, setting_value, category, display_name, 
    description, default_value, is_critical, requires_restart, 
    dependencies, display_order, help_text
  )
  VALUES
    -- Essential Ticket Settings
    (p_store_id, 'enable_ticket_approval_system', to_jsonb(true), 'Tickets', 'Enable ticket approval system',
     'Require management approval before collecting payment', to_jsonb(true), true, true,
     '[{"key": "auto_approve_after_48_hours", "type": "affects"}, {"key": "admin_review_rejected_tickets", "type": "affects"}]'::jsonb,
     10, 'When enabled, tickets must be approved by management before payment collection.'),
    
    -- Essential Cash Settings
    (p_store_id, 'require_opening_cash_count', to_jsonb(true), 'Cash', 'Require opening cash count before creating tickets',
     'Must count opening cash before tickets can be created', to_jsonb(true), true, false,
     '[{"key": "show_opening_cash_missing_banner", "type": "affects"}]'::jsonb,
     10, 'Requires managers to count opening cash before any tickets can be created for the day.'),
    
    (p_store_id, 'show_opening_cash_missing_banner', to_jsonb(true), 'Cash', 'Show opening cash missing banner',
     'Display banner when opening cash count is missing', to_jsonb(true), false, false,
     '[{"key": "require_opening_cash_count", "type": "requires"}]'::jsonb,
     20, 'Shows a prominent banner when opening cash count has not been completed.'),
    
    -- Essential Attendance Settings
    (p_store_id, 'auto_checkout_employees_at_closing', to_jsonb(true), 'Attendance', 'Auto-checkout employees at closing time',
     'Automatically check out employees at store closing time', to_jsonb(true), true, false,
     '[]'::jsonb, 10, 'Automatically checks out all employees at the store''s closing time.');

  -- Add recommended settings if preset is 'recommended' or 'full'
  IF p_preset IN ('recommended', 'full') THEN
    INSERT INTO public.app_settings (
      store_id, setting_key, setting_value, category, display_name,
      description, default_value, is_critical, requires_restart,
      dependencies, display_order, help_text
    )
    VALUES
      (p_store_id, 'auto_approve_after_48_hours', to_jsonb(true), 'Tickets', 'Enable auto-approval after deadline',
       'Automatically approve pending tickets after configured deadline', to_jsonb(true), false, false,
       '[{"key": "enable_ticket_approval_system", "type": "requires"}]'::jsonb,
       20, 'Automatically approves tickets that have been pending past the configured approval deadline.'),
      
      (p_store_id, 'auto_approval_minutes', to_jsonb(2880), 'Tickets', 'Auto-approval time period',
       'Number of minutes before pending tickets are automatically approved', to_jsonb(2880), false, false,
       '[{"key": "auto_approve_after_48_hours", "type": "requires", "label": "Enable auto-approval"}]'::jsonb,
       25, 'Set the time period (in minutes) before pending tickets are automatically approved. Range: 10 minutes to 10080 minutes (7 days). Default is 2880 minutes (48 hours).'),
      
      (p_store_id, 'enable_ready_queue', to_jsonb(true), 'Queue', 'Enable technician ready queue',
       'Allow technicians to join a ready queue for next customer', to_jsonb(true), false, false,
       '[{"key": "show_queue_button_in_header", "type": "affects"}]'::jsonb,
       10, 'Enables the technician ready queue system for managing customer flow.'),
      
      (p_store_id, 'show_queue_button_in_header', to_jsonb(true), 'Queue', 'Show queue button in header',
       'Display queue button in navigation header', to_jsonb(true), false, false,
       '[{"key": "enable_ready_queue", "type": "requires"}]'::jsonb,
       20, 'Displays a queue button in the header navigation for quick access.');
  END IF;

  -- Add full/advanced settings if preset is 'full'
  IF p_preset = 'full' THEN
    INSERT INTO public.app_settings (
      store_id, setting_key, setting_value, category, display_name,
      description, default_value, is_critical, requires_restart,
      dependencies, display_order, help_text
    )
    VALUES
      (p_store_id, 'enable_inventory_module', to_jsonb(false), 'System', 'Enable inventory module',
       'Enable full inventory management features', to_jsonb(false), true, true,
       '[]'::jsonb, 20, 'Enables the full inventory management module.'),
      
      (p_store_id, 'enable_realtime_refresh', to_jsonb(true), 'System', 'Enable real-time data refresh',
       'Automatically refresh data when changes occur', to_jsonb(true), true, true,
       '[]'::jsonb, 10, 'Enables automatic real-time updates for data changes.'),
      
      (p_store_id, 'enable_self_service_tickets', to_jsonb(false), 'Tickets', 'Enable self-service tickets',
       'Allow technicians to create their own tickets', to_jsonb(false), false, false,
       '[]'::jsonb, 40, 'When enabled, technicians can create their own tickets.'),
      
      (p_store_id, 'admin_review_rejected_tickets', to_jsonb(false), 'Tickets', 'Admin review for rejected tickets',
       'Require admin review for rejected tickets', to_jsonb(false), false, false,
       '[{"key": "enable_ticket_approval_system", "type": "requires"}]'::jsonb,
       30, 'Requires admin review for tickets that were rejected.');
  END IF;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Settings initialized successfully',
    'preset', p_preset,
    'settings_count', v_count
  );
END;
$$;
