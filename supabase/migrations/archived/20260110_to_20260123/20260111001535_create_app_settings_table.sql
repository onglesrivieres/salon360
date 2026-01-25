/*
  # Create App Settings System

  This migration creates the complete app_settings infrastructure that was missing:
  1. app_settings table - stores configuration per store
  2. app_settings_audit table - tracks changes to settings
  3. RPC functions - store_has_configuration, validate_store_configuration, initialize_store_settings
  4. RLS policies - secure access control
  5. Indexes - performance optimization
*/

-- =============================================================================
-- 1. CREATE TABLES
-- =============================================================================

-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  setting_value jsonb NOT NULL DEFAULT 'false'::jsonb,
  category text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  default_value jsonb NOT NULL DEFAULT 'false'::jsonb,
  is_critical boolean DEFAULT false,
  requires_restart boolean DEFAULT false,
  dependencies jsonb DEFAULT '[]'::jsonb,
  display_order integer DEFAULT 0,
  help_text text DEFAULT '',
  updated_by uuid REFERENCES public.employees(id),
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(store_id, setting_key)
);

-- Add check constraints for JSONB values
ALTER TABLE public.app_settings
ADD CONSTRAINT check_setting_value_is_primitive
CHECK (jsonb_typeof(setting_value) IN ('boolean', 'number', 'string', 'null'));

ALTER TABLE public.app_settings
ADD CONSTRAINT check_default_value_is_primitive
CHECK (jsonb_typeof(default_value) IN ('boolean', 'number', 'string', 'null'));

-- Create app_settings_audit table
CREATE TABLE IF NOT EXISTS public.app_settings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid REFERENCES public.employees(id),
  is_critical boolean DEFAULT false,
  change_notes text,
  created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- 2. CREATE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_app_settings_store_id ON public.app_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_category_order ON public.app_settings(store_id, category, display_order);
CREATE INDEX IF NOT EXISTS idx_app_settings_critical ON public.app_settings(store_id, is_critical) WHERE is_critical = true;
CREATE INDEX IF NOT EXISTS idx_app_settings_dependencies ON public.app_settings USING gin(dependencies);
CREATE INDEX IF NOT EXISTS idx_app_settings_audit_store_id ON public.app_settings_audit(store_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_audit_created_at ON public.app_settings_audit(created_at);

-- =============================================================================
-- 3. ENABLE RLS
-- =============================================================================

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings_audit ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. CREATE RLS POLICIES
-- =============================================================================

-- app_settings policies
CREATE POLICY "Allow anon read access to app_settings"
  ON public.app_settings
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert to app_settings"
  ON public.app_settings
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update to app_settings"
  ON public.app_settings
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete from app_settings"
  ON public.app_settings
  FOR DELETE
  TO anon
  USING (true);

-- app_settings_audit policies
CREATE POLICY "Allow anon read access to app_settings_audit"
  ON public.app_settings_audit
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert to app_settings_audit"
  ON public.app_settings_audit
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- =============================================================================
-- 5. CREATE RPC FUNCTIONS
-- =============================================================================

-- Function: store_has_configuration
-- Returns true if the store has any settings configured
CREATE OR REPLACE FUNCTION public.store_has_configuration(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_settings WHERE store_id = p_store_id
  );
END;
$$;

-- Function: validate_store_configuration
-- Validates store configuration and returns any issues found
CREATE OR REPLACE FUNCTION public.validate_store_configuration(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues jsonb := '[]'::jsonb;
  v_settings jsonb;
  v_setting record;
BEGIN
  -- Get all settings for the store as a lookup
  SELECT jsonb_object_agg(setting_key, setting_value)
  INTO v_settings
  FROM public.app_settings
  WHERE store_id = p_store_id;

  -- If no settings, return empty issues
  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('issues', '[]'::jsonb);
  END IF;

  -- Check dependency validations
  FOR v_setting IN
    SELECT setting_key, setting_value, dependencies
    FROM public.app_settings
    WHERE store_id = p_store_id
      AND dependencies IS NOT NULL
      AND jsonb_array_length(dependencies) > 0
      AND setting_value = 'true'::jsonb
  LOOP
    -- Check each dependency
    FOR i IN 0..jsonb_array_length(v_setting.dependencies) - 1 LOOP
      DECLARE
        v_dep jsonb := v_setting.dependencies->i;
        v_dep_key text := v_dep->>'key';
        v_dep_type text := v_dep->>'type';
        v_dep_label text := v_dep->>'label';
        v_dep_value jsonb;
      BEGIN
        v_dep_value := v_settings->v_dep_key;

        -- Check "requires" dependencies
        IF v_dep_type = 'requires' AND (v_dep_value IS NULL OR v_dep_value = 'false'::jsonb) THEN
          v_issues := v_issues || jsonb_build_object(
            'type', 'dependency',
            'setting', v_setting.setting_key,
            'requires', v_dep_key,
            'message', format('%s requires %s to be enabled', v_setting.setting_key, v_dep_label)
          );
        END IF;

        -- Check "conflicts" dependencies
        IF v_dep_type = 'conflicts' AND v_dep_value = 'true'::jsonb THEN
          v_issues := v_issues || jsonb_build_object(
            'type', 'conflict',
            'setting', v_setting.setting_key,
            'conflicts', v_dep_key,
            'message', format('%s conflicts with %s', v_setting.setting_key, v_dep_label)
          );
        END IF;
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('issues', v_issues);
END;
$$;

-- Function: initialize_store_settings
-- Initializes settings for a store based on a preset
CREATE OR REPLACE FUNCTION public.initialize_store_settings(p_store_id uuid, p_preset text DEFAULT 'recommended')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Validate preset
  IF p_preset NOT IN ('minimal', 'recommended', 'full') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid preset. Use: minimal, recommended, or full');
  END IF;

  -- Check if store exists
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Store not found');
  END IF;

  -- Delete existing settings for the store (start fresh)
  DELETE FROM public.app_settings WHERE store_id = p_store_id;

  -- ==========================================================================
  -- TICKETS CATEGORY
  -- ==========================================================================

  -- enable_ticket_approval_system (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'enable_ticket_approval_system',
    CASE WHEN p_preset IN ('minimal', 'recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Tickets',
    'Enable Ticket Approval System',
    'Tickets must be approved by management before payment collection',
    'true'::jsonb,
    true,
    true,
    'When enabled, tickets must be approved by management before payment collection.',
    10,
    '[{"key": "auto_approve_after_48_hours", "type": "affects", "label": "Auto-approve after 48 hours"}, {"key": "admin_review_rejected_tickets", "type": "affects", "label": "Admin review for rejected tickets"}]'::jsonb
  );

  -- auto_approve_after_48_hours
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'auto_approve_after_48_hours',
    CASE WHEN p_preset IN ('recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Tickets',
    'Auto-Approve After 48 Hours',
    'Automatically approve tickets after 48 hours if not manually reviewed',
    'true'::jsonb,
    false,
    'Tickets that are not manually approved or rejected within 48 hours will be automatically approved.',
    20,
    '[{"key": "enable_ticket_approval_system", "type": "requires", "label": "Enable ticket approval system"}]'::jsonb
  );

  -- admin_review_rejected_tickets
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'admin_review_rejected_tickets',
    CASE WHEN p_preset = 'full' THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Tickets',
    'Admin Review Rejected Tickets',
    'Require admin review for tickets rejected by supervisors',
    'false'::jsonb,
    'When enabled, tickets rejected by supervisors must be reviewed by an admin before final rejection.',
    30,
    '[{"key": "enable_ticket_approval_system", "type": "requires", "label": "Enable ticket approval system"}]'::jsonb
  );

  -- require_customer_name_on_tickets
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'require_customer_name_on_tickets',
    'false'::jsonb,
    'Tickets',
    'Require Customer Name',
    'Forces entry of customer name on all tickets',
    'false'::jsonb,
    'When enabled, tickets cannot be created or closed without a customer name.',
    60
  );

  -- require_customer_phone_on_tickets
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'require_customer_phone_on_tickets',
    'false'::jsonb,
    'Tickets',
    'Require Customer Phone',
    'Forces entry of customer phone number on all tickets',
    'false'::jsonb,
    'When enabled, tickets cannot be created or closed without a customer phone number.',
    70
  );

  -- require_employee_checkin_before_tickets
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'require_employee_checkin_before_tickets',
    'true'::jsonb,
    'Tickets',
    'Require Employee Check-In',
    'Employees must be checked in to be assigned tickets',
    'true'::jsonb,
    'When enabled, only employees who have checked in can be assigned to tickets.',
    80
  );

  -- enable_ticket_notes
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_ticket_notes',
    'true'::jsonb,
    'Tickets',
    'Enable Ticket Notes',
    'Allow adding notes and comments to tickets',
    'true'::jsonb,
    'When enabled, staff can add internal notes to tickets.',
    90
  );

  -- show_ticket_timer_warnings
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'show_ticket_timer_warnings',
    'true'::jsonb,
    'Tickets',
    'Show Timer Warnings',
    'Display warnings when service time exceeds expected duration',
    'true'::jsonb,
    'When enabled, tickets that exceed their expected service time will show a warning.',
    100
  );

  -- ==========================================================================
  -- PAYMENT CATEGORY
  -- ==========================================================================

  -- enable_cash_payments
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_cash_payments',
    'true'::jsonb,
    'Payment',
    'Enable Cash Payments',
    'Allow customers to pay with cash',
    'true'::jsonb,
    'When enabled, cash will be available as a payment method.',
    10
  );

  -- enable_card_payments
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_card_payments',
    'true'::jsonb,
    'Payment',
    'Enable Card Payments',
    'Allow customers to pay with credit/debit cards',
    'true'::jsonb,
    'When enabled, card will be available as a payment method.',
    20
  );

  -- enable_gift_card_payments
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_gift_card_payments',
    'true'::jsonb,
    'Payment',
    'Enable Gift Card Payments',
    'Allow customers to pay with gift cards',
    'true'::jsonb,
    'When enabled, gift card will be available as a payment method.',
    30
  );

  -- enable_mixed_payment_methods
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'enable_mixed_payment_methods',
    'true'::jsonb,
    'Payment',
    'Enable Mixed Payments',
    'Allow customers to split payment across multiple methods',
    'true'::jsonb,
    'When enabled, customers can split their payment between cash, card, and gift card.',
    40,
    '[{"key": "enable_cash_payments", "type": "requires", "label": "Enable cash payments"}, {"key": "enable_card_payments", "type": "requires", "label": "Enable card payments"}]'::jsonb
  );

  -- allow_ticket_discounts (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order)
  VALUES (
    p_store_id,
    'allow_ticket_discounts',
    'false'::jsonb,
    'Payment',
    'Allow Ticket Discounts',
    'Enable discount functionality on tickets',
    'false'::jsonb,
    true,
    'When enabled, authorized staff can apply discounts to tickets. This is a sensitive setting.',
    50
  );

  -- require_opening_cash_validation
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'require_opening_cash_validation',
    'false'::jsonb,
    'Payment',
    'Require Opening Cash Validation',
    'Validate opening cash count before allowing cash payments',
    'false'::jsonb,
    'When enabled, cash payments are blocked until the opening cash count is validated.',
    60
  );

  -- ==========================================================================
  -- EMPLOYEE CATEGORY
  -- ==========================================================================

  -- show_tip_details_to_technicians
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'show_tip_details_to_technicians',
    'true'::jsonb,
    'Employee',
    'Show Tip Details to Technicians',
    'Allow technicians to see detailed tip breakdowns',
    'true'::jsonb,
    'When enabled, technicians can view detailed tip information.',
    10
  );

  -- enable_tip_pairing_mode
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_tip_pairing_mode',
    'true'::jsonb,
    'Employee',
    'Enable Tip Pairing',
    'Allow technicians to work in pairs and share tips',
    'true'::jsonb,
    'When enabled, two technicians can be assigned to the same service and split tips.',
    20
  );

  -- show_attendance_on_home_page
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'show_attendance_on_home_page',
    'true'::jsonb,
    'Employee',
    'Show Attendance on Home',
    'Display quick attendance check-in/out on home page',
    'true'::jsonb,
    'When enabled, employees can quickly check in and out from the home page.',
    30
  );

  -- ==========================================================================
  -- OPERATIONS CATEGORY
  -- ==========================================================================

  -- enable_ready_queue
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_ready_queue',
    CASE WHEN p_preset IN ('recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Operations',
    'Enable Ready Queue',
    'Enable the technician ready queue system',
    'true'::jsonb,
    'When enabled, technicians can join a queue to indicate availability.',
    40
  );

  -- show_queue_button_in_header
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'show_queue_button_in_header',
    CASE WHEN p_preset IN ('recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Operations',
    'Show Queue Button in Header',
    'Display a quick-access queue button in the header',
    'true'::jsonb,
    'When enabled, shows a button in the header for quick access to the queue.',
    50,
    '[{"key": "enable_ready_queue", "type": "requires", "label": "Enable ready queue"}]'::jsonb
  );

  -- auto_checkout_employees_at_closing (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order)
  VALUES (
    p_store_id,
    'auto_checkout_employees_at_closing',
    CASE WHEN p_preset IN ('minimal', 'recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Operations',
    'Auto-Checkout at Closing',
    'Automatically checks out all employees at closing time',
    'true'::jsonb,
    true,
    'Automatically checks out all employees at the store closing time.',
    10
  );

  -- require_opening_cash_count (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order)
  VALUES (
    p_store_id,
    'require_opening_cash_count',
    CASE WHEN p_preset IN ('minimal', 'recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Operations',
    'Require Opening Cash Count',
    'Requires managers to count opening cash before tickets can be created',
    'true'::jsonb,
    true,
    'Requires managers to count opening cash before any tickets can be created for the day.',
    10
  );

  -- show_opening_cash_missing_banner
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'show_opening_cash_missing_banner',
    'true'::jsonb,
    'Operations',
    'Show Opening Cash Banner',
    'Display a banner when opening cash count is missing',
    'true'::jsonb,
    'When enabled, shows a warning banner when the opening cash count has not been submitted.',
    20,
    '[{"key": "require_opening_cash_count", "type": "requires", "label": "Require opening cash count"}]'::jsonb
  );

  -- ==========================================================================
  -- NOTIFICATIONS CATEGORY
  -- ==========================================================================

  -- show_version_notifications
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'show_version_notifications',
    'true'::jsonb,
    'Notifications',
    'Show Version Updates',
    'Display banner when new app version is available',
    'true'::jsonb,
    'When enabled, a notification banner appears when a new version is available.',
    10
  );

  -- show_pending_approval_badge
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'show_pending_approval_badge',
    'true'::jsonb,
    'Notifications',
    'Show Approval Badge',
    'Display count of pending approvals in navigation',
    'true'::jsonb,
    'When enabled, shows a badge with the number of items pending approval.',
    20
  );

  -- enable_approval_deadline_warnings
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'enable_approval_deadline_warnings',
    'true'::jsonb,
    'Notifications',
    'Approval Deadline Warnings',
    'Show warnings for approvals approaching auto-approval deadline',
    'true'::jsonb,
    'When enabled, displays warnings for tickets approaching the auto-approval deadline.',
    30,
    '[{"key": "auto_approve_after_48_hours", "type": "requires", "label": "Auto-approve after 48 hours"}]'::jsonb
  );

  -- ==========================================================================
  -- SYSTEM CATEGORY
  -- ==========================================================================

  -- enable_realtime_refresh (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_realtime_refresh',
    CASE WHEN p_preset = 'full' THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'System',
    'Enable Real-time Refresh',
    'Enables automatic real-time updates for data changes',
    'false'::jsonb,
    true,
    true,
    'Enables automatic real-time updates for data changes across all devices.',
    10
  );

  -- enable_inventory_module (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_inventory_module',
    'true'::jsonb,
    'System',
    'Enable Inventory Module',
    'Enables the full inventory management module',
    'true'::jsonb,
    true,
    true,
    'Enables the full inventory management module including stock tracking, distributions, and audits.',
    20
  );

  -- enable_audit_logging
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_audit_logging',
    'true'::jsonb,
    'System',
    'Enable Audit Logging',
    'Track all configuration changes and critical actions',
    'true'::jsonb,
    'When enabled, all changes to settings and critical actions are logged.',
    30
  );

  -- store_timezone
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'store_timezone',
    '"America/New_York"'::jsonb,
    'System',
    'Store Timezone',
    'The timezone for this store',
    '"America/New_York"'::jsonb,
    'Set the timezone for this store. All times will be displayed in this timezone.',
    40
  );

  -- auto_approval_minutes
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order)
  VALUES (
    p_store_id,
    'auto_approval_minutes',
    '2880'::jsonb,
    'System',
    'Auto-Approval Time (Supervisor)',
    'Minutes before tickets are auto-approved for supervisors',
    '2880'::jsonb,
    true,
    'Time in minutes before tickets are automatically approved if not manually reviewed (2880 = 48 hours).',
    50
  );

  -- auto_approval_minutes_manager
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order)
  VALUES (
    p_store_id,
    'auto_approval_minutes_manager',
    '2880'::jsonb,
    'System',
    'Auto-Approval Time (Manager)',
    'Minutes before tickets are auto-approved for managers',
    '2880'::jsonb,
    true,
    'Time in minutes before tickets requiring manager approval are automatically approved (2880 = 48 hours).',
    60
  );

  -- violation_min_votes_required
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'violation_min_votes_required',
    '3'::jsonb,
    'System',
    'Minimum Violation Votes',
    'Minimum votes required to flag a violation',
    '3'::jsonb,
    'The minimum number of votes required before a violation is flagged for review.',
    70
  );

  -- Count total settings created
  SELECT COUNT(*) INTO v_count FROM public.app_settings WHERE store_id = p_store_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully initialized %s settings with %s preset', v_count, p_preset),
    'settings_count', v_count
  );
END;
$$;

-- =============================================================================
-- 6. GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.store_has_configuration(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_store_configuration(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.initialize_store_settings(uuid, text) TO anon;

-- =============================================================================
-- 7. ADD COMMENTS
-- =============================================================================

COMMENT ON TABLE public.app_settings IS 'Stores per-store application configuration settings';
COMMENT ON TABLE public.app_settings_audit IS 'Audit log for changes to app settings';
COMMENT ON FUNCTION public.store_has_configuration(uuid) IS 'Returns true if the store has any settings configured';
COMMENT ON FUNCTION public.validate_store_configuration(uuid) IS 'Validates store configuration and returns any issues found';
COMMENT ON FUNCTION public.initialize_store_settings(uuid, text) IS 'Initializes settings for a store based on a preset (minimal, recommended, full)';
