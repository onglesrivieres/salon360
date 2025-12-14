/*
  # Replace Store Configuration Management Functions
  
  1. Drop Old Functions
    - Remove outdated initialize_store_settings function
    
  2. Create New Functions
    - initialize_store_settings with preset support
    - copy_store_settings for inheritance
    - validate_store_configuration for conflict detection
*/

-- Drop old function
DROP FUNCTION IF EXISTS public.initialize_store_settings(uuid);

-- Function to check if a store has any settings configured
CREATE OR REPLACE FUNCTION public.store_has_configuration(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.app_settings 
    WHERE store_id = p_store_id
  );
END;
$$;

-- Function to initialize default settings for a new store (manual)
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
    (p_store_id, 'enable_ticket_approval_system', true, 'Tickets', 'Enable ticket approval system',
     'Require management approval before collecting payment', true, true, true,
     '[{"key": "auto_approve_after_48_hours", "type": "affects"}, {"key": "admin_review_rejected_tickets", "type": "affects"}]'::jsonb,
     10, 'When enabled, tickets must be approved by management before payment collection.'),
    
    -- Essential Cash Settings
    (p_store_id, 'require_opening_cash_count', true, 'Cash', 'Require opening cash count before creating tickets',
     'Must count opening cash before tickets can be created', true, true, false,
     '[{"key": "show_opening_cash_missing_banner", "type": "affects"}]'::jsonb,
     10, 'Requires managers to count opening cash before any tickets can be created for the day.'),
    
    (p_store_id, 'show_opening_cash_missing_banner', true, 'Cash', 'Show opening cash missing banner',
     'Display banner when opening cash count is missing', true, false, false,
     '[{"key": "require_opening_cash_count", "type": "requires"}]'::jsonb,
     20, 'Shows a prominent banner when opening cash count has not been completed.'),
    
    -- Essential Attendance Settings
    (p_store_id, 'auto_checkout_employees_at_closing', true, 'Attendance', 'Auto-checkout employees at closing time',
     'Automatically check out employees at store closing time', true, true, false,
     '[]'::jsonb, 10, 'Automatically checks out all employees at the store''s closing time.');

  -- Add recommended settings if preset is 'recommended' or 'full'
  IF p_preset IN ('recommended', 'full') THEN
    INSERT INTO public.app_settings (
      store_id, setting_key, setting_value, category, display_name,
      description, default_value, is_critical, requires_restart,
      dependencies, display_order, help_text
    )
    VALUES
      (p_store_id, 'auto_approve_after_48_hours', true, 'Tickets', 'Auto-approve tickets after 48 hours',
       'Automatically approve pending tickets after 48 hours', true, false, false,
       '[{"key": "enable_ticket_approval_system", "type": "requires"}]'::jsonb,
       20, 'Automatically approves tickets that have been pending for more than 48 hours.'),
      
      (p_store_id, 'enable_ready_queue', true, 'Queue', 'Enable technician ready queue',
       'Allow technicians to join a ready queue for next customer', true, false, false,
       '[{"key": "show_queue_button_in_header", "type": "affects"}]'::jsonb,
       10, 'Enables the technician ready queue system for managing customer flow.'),
      
      (p_store_id, 'show_queue_button_in_header', true, 'Queue', 'Show queue button in header',
       'Display queue button in navigation header', true, false, false,
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
      (p_store_id, 'enable_inventory_module', false, 'System', 'Enable inventory module',
       'Enable full inventory management features', false, true, true,
       '[]'::jsonb, 20, 'Enables the full inventory management module.'),
      
      (p_store_id, 'enable_realtime_refresh', true, 'System', 'Enable real-time data refresh',
       'Automatically refresh data when changes occur', true, true, true,
       '[]'::jsonb, 10, 'Enables automatic real-time updates for data changes.'),
      
      (p_store_id, 'enable_self_service_tickets', false, 'Tickets', 'Enable self-service tickets',
       'Allow technicians to create their own tickets', false, false, false,
       '[]'::jsonb, 40, 'When enabled, technicians can create their own tickets.'),
      
      (p_store_id, 'admin_review_rejected_tickets', false, 'Tickets', 'Admin review for rejected tickets',
       'Require admin review for rejected tickets', false, false, false,
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

-- Function to copy settings from one store to another
CREATE OR REPLACE FUNCTION public.copy_store_settings(
  p_from_store_id uuid,
  p_to_store_id uuid,
  p_overwrite boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_skipped integer := 0;
  v_setting record;
BEGIN
  -- Verify both stores exist
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_from_store_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Source store does not exist');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_to_store_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Target store does not exist');
  END IF;

  -- Check if target already has settings
  IF NOT p_overwrite AND public.store_has_configuration(p_to_store_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Target store already has configuration. Use overwrite=true to replace.'
    );
  END IF;

  -- Copy settings
  FOR v_setting IN 
    SELECT * FROM public.app_settings WHERE store_id = p_from_store_id
  LOOP
    -- Check if setting already exists
    IF EXISTS (
      SELECT 1 FROM public.app_settings 
      WHERE store_id = p_to_store_id AND setting_key = v_setting.setting_key
    ) THEN
      IF p_overwrite THEN
        UPDATE public.app_settings
        SET 
          setting_value = v_setting.setting_value,
          category = v_setting.category,
          display_name = v_setting.display_name,
          description = v_setting.description,
          is_critical = v_setting.is_critical,
          requires_restart = v_setting.requires_restart,
          dependencies = v_setting.dependencies,
          display_order = v_setting.display_order,
          help_text = v_setting.help_text,
          updated_at = now()
        WHERE store_id = p_to_store_id AND setting_key = v_setting.setting_key;
        v_count := v_count + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    ELSE
      INSERT INTO public.app_settings (
        store_id, setting_key, setting_value, category, display_name,
        description, default_value, is_critical, requires_restart,
        dependencies, display_order, help_text
      ) VALUES (
        p_to_store_id, v_setting.setting_key, v_setting.setting_value,
        v_setting.category, v_setting.display_name, v_setting.description,
        v_setting.default_value, v_setting.is_critical, v_setting.requires_restart,
        v_setting.dependencies, v_setting.display_order, v_setting.help_text
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Settings copied successfully',
    'copied', v_count,
    'skipped', v_skipped
  );
END;
$$;

-- Function to validate configuration and check for conflicts
CREATE OR REPLACE FUNCTION public.validate_store_configuration(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues jsonb := '[]'::jsonb;
  v_setting record;
  v_dep jsonb;
  v_dep_key text;
  v_dep_type text;
BEGIN
  -- Check if store has any settings
  IF NOT public.store_has_configuration(p_store_id) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'message', 'Store has no configuration',
      'issues', '[]'::jsonb
    );
  END IF;

  -- Check dependency requirements
  FOR v_setting IN 
    SELECT * FROM public.app_settings 
    WHERE store_id = p_store_id 
      AND setting_value = true 
      AND dependencies IS NOT NULL 
      AND jsonb_array_length(dependencies) > 0
  LOOP
    FOR v_dep IN SELECT * FROM jsonb_array_elements(v_setting.dependencies)
    LOOP
      v_dep_key := v_dep->>'key';
      v_dep_type := v_dep->>'type';
      
      -- Check if required dependency is enabled
      IF v_dep_type = 'requires' THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.app_settings
          WHERE store_id = p_store_id
            AND setting_key = v_dep_key
            AND setting_value = true
        ) THEN
          v_issues := v_issues || jsonb_build_object(
            'type', 'missing_dependency',
            'setting', v_setting.setting_key,
            'requires', v_dep_key,
            'message', format('"%s" requires "%s" to be enabled', v_setting.display_name, v_dep->>'label')
          );
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'valid', jsonb_array_length(v_issues) = 0,
    'message', CASE 
      WHEN jsonb_array_length(v_issues) = 0 THEN 'Configuration is valid'
      ELSE format('Found %s configuration issue(s)', jsonb_array_length(v_issues))
    END,
    'issues', v_issues
  );
END;
$$;

COMMENT ON FUNCTION public.initialize_store_settings IS 'Manually initialize settings for a new store. Does not overwrite existing configuration.';
COMMENT ON FUNCTION public.copy_store_settings IS 'Copy settings from one store to another. Useful for multi-store businesses.';
COMMENT ON FUNCTION public.validate_store_configuration IS 'Validate store configuration and check for dependency conflicts.';
