/*
  # Add Timezone Setting to Store Initialization

  1. Overview
    - Updates initialize_store_settings function
    - Adds store_timezone setting to essential settings
    - Ensures all new stores get timezone configuration
    - Display order 5 in System category (before other settings)

  2. Changes
    - Add store_timezone to essential settings with default 'America/New_York'
    - Marked as critical setting requiring confirmation
    - Includes comprehensive help text with timezone options
*/

CREATE OR REPLACE FUNCTION public.initialize_store_settings(
  p_store_id uuid,
  p_preset text DEFAULT 'recommended'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Essential settings (included in all presets)
  IF p_preset IN ('essential', 'recommended', 'full') THEN
    INSERT INTO public.app_settings (
      store_id, setting_key, setting_value, category, display_name,
      description, default_value, is_critical, requires_restart,
      dependencies, display_order, help_text
    )
    VALUES
    -- System: Timezone
    (p_store_id, 'store_timezone', to_jsonb('America/New_York'::text), 'System', 'Store Timezone',
     'Set the timezone for all time-based operations', to_jsonb('America/New_York'::text), true, true,
     '[{"key": "auto_checkout_employees_at_closing", "type": "affects", "label": "Auto-checkout timing"}, {"key": "enable_ticket_approval_system", "type": "affects", "label": "Approval deadlines"}]'::jsonb,
     5, 'This setting controls which timezone is used for all time-based operations including attendance tracking, report generation, and automatic processes. Changing this will affect how times are displayed throughout the application. All data is stored in UTC, so changing this setting will not affect historical data accuracy. Common US timezones: America/New_York (Eastern), America/Chicago (Central), America/Denver (Mountain), America/Los_Angeles (Pacific), America/Anchorage (Alaska), Pacific/Honolulu (Hawaii).'),
    
    -- Essential Ticket Settings
    (p_store_id, 'enable_ticket_approval_system', to_jsonb(true), 'Tickets', 'Enable ticket approval system',
     'Require management approval before collecting payment', to_jsonb(true), true, true,
     '[{"key": "auto_approve_after_48_hours", "type": "affects"}, {"key": "admin_review_rejected_tickets", "type": "affects"}]'::jsonb,
     10, 'When enabled, tickets must be approved by management before payment collection.'),
    
    -- Essential Cash Settings
    (p_store_id, 'require_opening_cash_validation', to_jsonb(true), 'Cash', 'Require opening cash validation',
     'Prevent ticket creation before opening cash is counted', to_jsonb(true), true, true,
     '[]'::jsonb,
     10, 'When enabled, employees cannot create tickets until opening cash has been counted and validated.');
    
    v_count := v_count + 3;
  END IF;

  -- Recommended settings (included in recommended and full presets)
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
      
      (p_store_id, 'auto_approval_minutes', to_jsonb(2880), 'Tickets', 'Auto-approval time period (Standard)',
       'Number of minutes before standard technician/supervisor approval tickets are automatically approved', to_jsonb(2880), false, false,
       '[{"key": "auto_approve_after_48_hours", "type": "requires", "label": "Enable auto-approval"}]'::jsonb,
       25, 'Set the time period (in minutes) before pending tickets requiring standard (technician/supervisor) approval are automatically approved. Range: 10 minutes to 10080 minutes (7 days). Default is 2880 minutes (48 hours).'),
      
      (p_store_id, 'auto_approval_minutes_manager', to_jsonb(2880), 'Tickets', 'Auto-approval time period (Manager/Admin)',
       'Number of minutes before manager/admin approval tickets are automatically approved', to_jsonb(2880), false, false,
       '[{"key": "auto_approve_after_48_hours", "type": "requires", "label": "Enable auto-approval"}]'::jsonb,
       26, 'Set the time period (in minutes) before pending tickets requiring manager/admin approval are automatically approved. This applies to higher-level approvals. Range: 10 minutes to 10080 minutes (7 days). Default is 2880 minutes (48 hours).'),
      
      (p_store_id, 'enable_ready_queue', to_jsonb(true), 'Queue', 'Enable technician ready queue',
       'Allow technicians to join a ready queue for next customer', to_jsonb(true), false, false,
       '[{"key": "show_queue_button_in_header", "type": "affects"}]'::jsonb,
       10, 'Enables the technician ready queue system for managing customer flow.'),
      
      (p_store_id, 'show_queue_button_in_header', to_jsonb(true), 'Queue', 'Show queue button in header',
       'Display queue button in navigation header', to_jsonb(true), false, false,
       '[{"key": "enable_ready_queue", "type": "requires"}]'::jsonb,
       20, 'Displays a queue button in the header navigation for quick access.');
    
    v_count := v_count + 5;
  END IF;

  -- Full settings (included only in full preset)
  IF p_preset = 'full' THEN
    INSERT INTO public.app_settings (
      store_id, setting_key, setting_value, category, display_name,
      description, default_value, is_critical, requires_restart,
      dependencies, display_order, help_text
    )
    VALUES
      (p_store_id, 'admin_review_rejected_tickets', to_jsonb(false), 'Tickets', 'Admin review for rejected tickets',
       'Require admin review when tickets are rejected', to_jsonb(false), false, false,
       '[{"key": "enable_ticket_approval_system", "type": "requires"}]'::jsonb,
       30, 'When enabled, rejected tickets require additional admin review.'),
      
      (p_store_id, 'enable_approval_deadline_warnings', to_jsonb(true), 'Tickets', 'Enable approval deadline warnings',
       'Show warnings when tickets are approaching approval deadline', to_jsonb(true), false, false,
       '[{"key": "auto_approve_after_48_hours", "type": "requires", "label": "Auto-approve after 48 hours"}]'::jsonb,
       40, 'Displays warnings for pending tickets approaching their auto-approval deadline.');
    
    v_count := v_count + 2;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'store_id', p_store_id,
    'preset', p_preset,
    'settings_created', v_count,
    'message', format('Successfully initialized %s settings with "%s" preset', v_count, p_preset)
  );
END;
$$;

COMMENT ON FUNCTION public.initialize_store_settings(uuid, text) IS
'Initializes app settings for a new store with configurable presets: essential, recommended, or full. Includes timezone configuration.';