-- ============================================================================
-- Migration: Add Tax Feature
-- Description: Add GST/QST tax columns to sale_tickets and tax settings
--              to app_settings for configurable Quebec sales tax calculation.
-- ============================================================================

-- ============================================================================
-- 1. New columns on sale_tickets
-- ============================================================================

ALTER TABLE sale_tickets ADD COLUMN IF NOT EXISTS tax_gst numeric(10,2) DEFAULT 0.00;
ALTER TABLE sale_tickets ADD COLUMN IF NOT EXISTS tax_qst numeric(10,2) DEFAULT 0.00;
-- subtotal and tax columns already exist from migration 20260215213124

-- ============================================================================
-- 2. Update add_missing_store_settings() to include tax settings
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
  VALUES (p_store_id, 'auto_approval_minutes', '1440', '1440', 'System', 'Auto Approval Time', 'Time in minutes before tickets are auto-approved', 20)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'manager_approval_minutes', '2880', '2880', 'System', 'Manager Approval Time', 'Time in minutes for manager-level approval deadline', 25)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_audit_logging', 'true', 'true', 'System', 'Enable Audit Logging', 'Track changes and actions in audit logs', 30)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'store_timezone', '"America/New_York"', '"America/New_York"', 'System', 'Store Timezone', 'Timezone used for store operations', 40)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_inventory', 'true', 'true', 'System', 'Enable Inventory', 'Enable inventory management features', 50)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'violation_min_votes_required', '3', '3', 'System', 'Minimum Violation Votes', 'Minimum number of votes required for a violation to be confirmed', 60)
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
  VALUES (p_store_id, 'show_todays_color_field', 'true', 'true', 'Tickets', 'Show Today Color Field', 'Display the today color field on tickets', 4)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_ticket_approval', 'true', 'true', 'Tickets', 'Enable Ticket Approval', 'Require approval for ticket changes', 5)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'auto_approve_simple_tickets', 'false', 'false', 'Tickets', 'Auto-Approve Simple Tickets', 'Automatically approve tickets that meet simple criteria', 6)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_customer_name_on_tickets', 'false', 'false', 'Tickets', 'Require Customer Name', 'Require customer name on all tickets', 7)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_customer_phone_on_tickets', 'false', 'false', 'Tickets', 'Require Customer Phone', 'Require customer phone number on all tickets', 8)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'show_customer_name_field', 'true', 'true', 'Tickets', 'Show Customer Name', 'Show customer name field on tickets', 9)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'show_customer_phone_field', 'true', 'true', 'Tickets', 'Show Customer Phone', 'Show customer phone field on tickets', 10)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_checkin_for_tickets', 'true', 'true', 'Tickets', 'Require Check-in for Tickets', 'Require employee check-in before creating tickets', 11)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- ========================================================================
  -- OPERATIONS CATEGORY (7 settings)
  -- ========================================================================

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order, dependencies)
  VALUES (p_store_id, 'enable_small_service', 'true', 'true', 'Operations', 'Enable Small Service', 'When enabled, technicians completing small tickets stay in the queue instead of being marked busy', 2, '[{"key": "small_service_threshold", "type": "affects", "label": "Small Service Threshold"}]'::jsonb)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order, dependencies)
  VALUES (p_store_id, 'small_service_threshold', '30', '30', 'Operations', 'Small Service Threshold', 'Ticket total below this amount is considered a small service', 3, '[{"key": "enable_small_service", "type": "requires", "label": "Enable Small Service"}]'::jsonb)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_auto_checkout', 'true', 'true', 'Operations', 'Enable Auto Checkout', 'Automatically check out employees at store closing time', 10)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_cash_count_on_checkout', 'false', 'false', 'Operations', 'Require Cash Count on Checkout', 'Require end-of-day cash count before allowing checkout', 20)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_queue_management', 'true', 'true', 'Operations', 'Enable Queue Management', 'Enable the technician ready queue system', 30)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_service_timers', 'true', 'true', 'Operations', 'Enable Service Timers', 'Track service duration with start/stop timers', 40)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_notes_on_tickets', 'true', 'true', 'Operations', 'Enable Notes on Tickets', 'Allow adding notes to tickets', 50)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- ========================================================================
  -- PAYMENT CATEGORY (9 settings — 6 existing + 3 new tax settings)
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

  -- Tax settings
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order, dependencies)
  VALUES (p_store_id, 'enable_tax', 'false', 'false', 'Payment', 'Enable Tax', 'Apply GST/QST sales tax on service charges', 70, '[{"key": "tax_rate_gst", "type": "affects", "label": "GST Rate"}, {"key": "tax_rate_qst", "type": "affects", "label": "QST Rate"}]'::jsonb)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order, dependencies)
  VALUES (p_store_id, 'tax_rate_gst', '5.0', '5.0', 'Payment', 'GST Rate (%)', 'Federal Goods and Services Tax rate', 80, '[{"key": "enable_tax", "type": "requires", "label": "Enable Tax"}]'::jsonb)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order, dependencies)
  VALUES (p_store_id, 'tax_rate_qst', '9.975', '9.975', 'Payment', 'QST Rate (%)', 'Quebec Sales Tax rate', 90, '[{"key": "enable_tax", "type": "requires", "label": "Enable Tax"}]'::jsonb)
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
  VALUES (p_store_id, 'show_approval_badge', 'true', 'true', 'Notifications', 'Show Approval Badge', 'Display pending approval count badge in navigation', 20)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'show_deadline_warnings', 'true', 'true', 'Notifications', 'Show Deadline Warnings', 'Display warnings for approaching approval deadlines', 30)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  RETURN v_added_count;
END;
$$;

-- ============================================================================
-- 3. Insert tax settings for all existing stores
-- ============================================================================

DO $$
DECLARE
  v_store RECORD;
BEGIN
  FOR v_store IN SELECT id FROM public.stores LOOP
    PERFORM public.add_missing_store_settings(v_store.id);
  END LOOP;
END;
$$;

-- ============================================================================
-- 4. Grant access
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.add_missing_store_settings(uuid) TO authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
