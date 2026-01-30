-- Migration: Sync All App Settings Between Databases
-- This migration ensures all stores have the complete set of 34 app settings
-- It updates the add_missing_store_settings() function and adds missing settings

-- ============================================================================
-- STEP 1: Insert all missing settings for all existing stores
-- Uses ON CONFLICT DO NOTHING for idempotency
-- ============================================================================

DO $$
DECLARE
  v_store_id uuid;
BEGIN
  FOR v_store_id IN SELECT id FROM stores LOOP

    -- ========================================================================
    -- SYSTEM CATEGORY
    -- ========================================================================

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_realtime_refresh', 'true', 'true', 'System', 'Enable Real-time Refresh', 'Enables automatic real-time updates for data changes', 10)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_inventory_module', 'true', 'true', 'System', 'Enable Inventory Module', 'Enables the full inventory management module', 20)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_audit_logging', 'true', 'true', 'System', 'Enable Audit Logging', 'Track all configuration changes and critical actions', 30)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'store_timezone', '"America/New_York"', '"America/New_York"', 'System', 'Store Timezone', 'The timezone for this store', 40)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'auto_approval_minutes', '2880', '2880', 'System', 'Auto-Approval Time (Supervisor)', 'Minutes before tickets are auto-approved for supervisors', 50)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'auto_approval_minutes_manager', '2880', '2880', 'System', 'Auto-Approval Time (Manager)', 'Minutes before tickets are auto-approved for managers', 60)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'violation_min_votes_required', '3', '3', 'System', 'Minimum Violation Votes', 'Minimum votes required to flag a violation', 70)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    -- ========================================================================
    -- TICKETS CATEGORY
    -- ========================================================================

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'require_todays_color', 'false', 'false', 'Tickets', 'Require Today Color', 'Require color entry for returning customers', 3)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_ticket_approval_system', 'true', 'true', 'Tickets', 'Enable Ticket Approval System', 'Tickets must be approved by management before payment collection', 10)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'auto_approve_after_48_hours', 'true', 'true', 'Tickets', 'Auto-Approve After 48 Hours', 'Automatically approve tickets after 48 hours if not manually reviewed', 20)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'admin_review_rejected_tickets', 'false', 'false', 'Tickets', 'Admin Review Rejected Tickets', 'Require admin review for tickets rejected by supervisors', 30)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'require_customer_name_on_tickets', 'false', 'false', 'Tickets', 'Require Customer Name', 'Forces entry of customer name on all tickets', 60)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'require_customer_phone_on_tickets', 'false', 'false', 'Tickets', 'Require Customer Phone', 'Forces entry of customer phone number on all tickets', 70)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'require_employee_checkin_before_tickets', 'true', 'true', 'Tickets', 'Require Employee Check-In', 'Employees must be checked in to be assigned tickets', 80)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_ticket_notes', 'true', 'true', 'Tickets', 'Enable Ticket Notes', 'Allow adding notes and comments to tickets', 90)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'show_ticket_timer_warnings', 'true', 'true', 'Tickets', 'Show Timer Warnings', 'Display warnings when service time exceeds expected duration', 100)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    -- ========================================================================
    -- OPERATIONS CATEGORY
    -- ========================================================================

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'small_service_threshold', '30', '30', 'Operations', 'Small Service Threshold', 'Ticket total below this amount is considered a small service', 3)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'auto_checkout_employees_at_closing', 'true', 'true', 'Operations', 'Auto-Checkout at Closing', 'Automatically checks out all employees at closing time', 10)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'require_opening_cash_count', 'true', 'true', 'Operations', 'Require Opening Cash Count', 'Requires managers to count opening cash before tickets can be created', 10)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'show_opening_cash_missing_banner', 'true', 'true', 'Operations', 'Show Opening Cash Banner', 'Display a banner when opening cash count is missing', 20)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_ready_queue', 'true', 'true', 'Operations', 'Enable Ready Queue', 'Enable the technician ready queue system', 40)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'show_queue_button_in_header', 'true', 'true', 'Operations', 'Show Queue Button in Header', 'Display a quick-access queue button in the header', 50)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    -- ========================================================================
    -- PAYMENT CATEGORY
    -- ========================================================================

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_cash_payments', 'true', 'true', 'Payment', 'Enable Cash Payments', 'Allow customers to pay with cash', 10)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_card_payments', 'true', 'true', 'Payment', 'Enable Card Payments', 'Allow customers to pay with credit/debit cards', 20)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_gift_card_payments', 'true', 'true', 'Payment', 'Enable Gift Card Payments', 'Allow customers to pay with gift cards', 30)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_mixed_payment_methods', 'true', 'true', 'Payment', 'Enable Mixed Payments', 'Allow customers to split payment across multiple methods', 40)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'allow_ticket_discounts', 'false', 'false', 'Payment', 'Allow Ticket Discounts', 'Enable discount functionality on tickets', 50)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'require_opening_cash_validation', 'true', 'true', 'Payment', 'Require Opening Cash Validation', 'Validate opening cash count before allowing cash payments', 60)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    -- ========================================================================
    -- EMPLOYEE CATEGORY
    -- ========================================================================

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'show_tip_details_to_technicians', 'true', 'true', 'Employee', 'Show Tip Details to Technicians', 'Allow technicians to see detailed tip breakdowns', 10)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_tip_pairing_mode', 'true', 'true', 'Employee', 'Enable Tip Pairing', 'Allow technicians to work in pairs and share tips', 20)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'show_attendance_on_home_page', 'true', 'true', 'Employee', 'Show Attendance on Home', 'Display quick attendance check-in/out on home page', 30)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    -- ========================================================================
    -- NOTIFICATIONS CATEGORY
    -- ========================================================================

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'show_version_notifications', 'true', 'true', 'Notifications', 'Show Version Updates', 'Display banner when new app version is available', 10)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'show_pending_approval_badge', 'true', 'true', 'Notifications', 'Show Approval Badge', 'Display count of pending approvals in navigation', 20)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

    INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
    VALUES (v_store_id, 'enable_approval_deadline_warnings', 'true', 'true', 'Notifications', 'Approval Deadline Warnings', 'Show warnings for approvals approaching auto-approval deadline', 30)
    ON CONFLICT (store_id, setting_key) DO NOTHING;

  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Clean up deprecated settings (if any)
-- Remove 'manager_approval_minutes' which is deprecated in favor of 'auto_approval_minutes_manager'
-- ============================================================================

DELETE FROM public.app_settings WHERE setting_key = 'manager_approval_minutes';

-- ============================================================================
-- STEP 3: Replace add_missing_store_settings() function with complete version
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_missing_store_settings(p_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_added_count integer := 0;
BEGIN
  -- ========================================================================
  -- SYSTEM CATEGORY (7 settings)
  -- ========================================================================

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_realtime_refresh', 'true', 'true', 'System', 'Enable Real-time Refresh', 'Enables automatic real-time updates for data changes', 10)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_inventory_module', 'true', 'true', 'System', 'Enable Inventory Module', 'Enables the full inventory management module', 20)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_audit_logging', 'true', 'true', 'System', 'Enable Audit Logging', 'Track all configuration changes and critical actions', 30)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'store_timezone', '"America/New_York"', '"America/New_York"', 'System', 'Store Timezone', 'The timezone for this store', 40)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'auto_approval_minutes', '2880', '2880', 'System', 'Auto-Approval Time (Supervisor)', 'Minutes before tickets are auto-approved for supervisors', 50)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'auto_approval_minutes_manager', '2880', '2880', 'System', 'Auto-Approval Time (Manager)', 'Minutes before tickets are auto-approved for managers', 60)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'violation_min_votes_required', '3', '3', 'System', 'Minimum Violation Votes', 'Minimum votes required to flag a violation', 70)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- ========================================================================
  -- TICKETS CATEGORY (9 settings)
  -- ========================================================================

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_todays_color', 'false', 'false', 'Tickets', 'Require Today Color', 'Require color entry for returning customers', 3)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_ticket_approval_system', 'true', 'true', 'Tickets', 'Enable Ticket Approval System', 'Tickets must be approved by management before payment collection', 10)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'auto_approve_after_48_hours', 'true', 'true', 'Tickets', 'Auto-Approve After 48 Hours', 'Automatically approve tickets after 48 hours if not manually reviewed', 20)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'admin_review_rejected_tickets', 'false', 'false', 'Tickets', 'Admin Review Rejected Tickets', 'Require admin review for tickets rejected by supervisors', 30)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_customer_name_on_tickets', 'false', 'false', 'Tickets', 'Require Customer Name', 'Forces entry of customer name on all tickets', 60)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_customer_phone_on_tickets', 'false', 'false', 'Tickets', 'Require Customer Phone', 'Forces entry of customer phone number on all tickets', 70)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_employee_checkin_before_tickets', 'true', 'true', 'Tickets', 'Require Employee Check-In', 'Employees must be checked in to be assigned tickets', 80)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_ticket_notes', 'true', 'true', 'Tickets', 'Enable Ticket Notes', 'Allow adding notes and comments to tickets', 90)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'show_ticket_timer_warnings', 'true', 'true', 'Tickets', 'Show Timer Warnings', 'Display warnings when service time exceeds expected duration', 100)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- ========================================================================
  -- OPERATIONS CATEGORY (6 settings)
  -- ========================================================================

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'small_service_threshold', '30', '30', 'Operations', 'Small Service Threshold', 'Ticket total below this amount is considered a small service', 3)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'auto_checkout_employees_at_closing', 'true', 'true', 'Operations', 'Auto-Checkout at Closing', 'Automatically checks out all employees at closing time', 10)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_opening_cash_count', 'true', 'true', 'Operations', 'Require Opening Cash Count', 'Requires managers to count opening cash before tickets can be created', 10)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'show_opening_cash_missing_banner', 'true', 'true', 'Operations', 'Show Opening Cash Banner', 'Display a banner when opening cash count is missing', 20)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_ready_queue', 'true', 'true', 'Operations', 'Enable Ready Queue', 'Enable the technician ready queue system', 40)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'show_queue_button_in_header', 'true', 'true', 'Operations', 'Show Queue Button in Header', 'Display a quick-access queue button in the header', 50)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- ========================================================================
  -- PAYMENT CATEGORY (6 settings)
  -- ========================================================================

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_cash_payments', 'true', 'true', 'Payment', 'Enable Cash Payments', 'Allow customers to pay with cash', 10)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_card_payments', 'true', 'true', 'Payment', 'Enable Card Payments', 'Allow customers to pay with credit/debit cards', 20)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_gift_card_payments', 'true', 'true', 'Payment', 'Enable Gift Card Payments', 'Allow customers to pay with gift cards', 30)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_mixed_payment_methods', 'true', 'true', 'Payment', 'Enable Mixed Payments', 'Allow customers to split payment across multiple methods', 40)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'allow_ticket_discounts', 'false', 'false', 'Payment', 'Allow Ticket Discounts', 'Enable discount functionality on tickets', 50)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_opening_cash_validation', 'true', 'true', 'Payment', 'Require Opening Cash Validation', 'Validate opening cash count before allowing cash payments', 60)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- ========================================================================
  -- EMPLOYEE CATEGORY (3 settings)
  -- ========================================================================

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'show_tip_details_to_technicians', 'true', 'true', 'Employee', 'Show Tip Details to Technicians', 'Allow technicians to see detailed tip breakdowns', 10)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_tip_pairing_mode', 'true', 'true', 'Employee', 'Enable Tip Pairing', 'Allow technicians to work in pairs and share tips', 20)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'show_attendance_on_home_page', 'true', 'true', 'Employee', 'Show Attendance on Home', 'Display quick attendance check-in/out on home page', 30)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- ========================================================================
  -- NOTIFICATIONS CATEGORY (3 settings)
  -- ========================================================================

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'show_version_notifications', 'true', 'true', 'Notifications', 'Show Version Updates', 'Display banner when new app version is available', 10)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'show_pending_approval_badge', 'true', 'true', 'Notifications', 'Show Approval Badge', 'Display count of pending approvals in navigation', 20)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_approval_deadline_warnings', 'true', 'true', 'Notifications', 'Approval Deadline Warnings', 'Show warnings for approvals approaching auto-approval deadline', 30)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  RETURN v_added_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.add_missing_store_settings(uuid) TO anon, authenticated, service_role;
