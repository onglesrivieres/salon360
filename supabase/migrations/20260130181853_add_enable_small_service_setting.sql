-- Migration: Add "Enable Small Service" toggle setting
-- Adds a master toggle to enable/disable the small service queue feature.
-- When disabled: technicians always go to 'busy' status, never 'small_service'.
-- Default: true (backward compatible — existing behavior unchanged).

-- ============================================================================
-- STEP 1: Insert enable_small_service setting for all existing stores
-- ============================================================================

INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order, dependencies)
SELECT
  s.id,
  'enable_small_service',
  'true'::jsonb,
  'true'::jsonb,
  'Operations',
  'Enable Small Service',
  'When enabled, technicians completing small tickets stay in the queue instead of being marked busy',
  2,
  '[{"key": "small_service_threshold", "type": "affects", "label": "Small Service Threshold"}]'::jsonb
FROM public.stores s
ON CONFLICT (store_id, setting_key) DO NOTHING;

-- ============================================================================
-- STEP 2: Update small_service_threshold dependencies to include 'requires'
-- ============================================================================

UPDATE public.app_settings
SET dependencies = '[{"key": "enable_small_service", "type": "requires", "label": "Enable Small Service"}]'::jsonb
WHERE setting_key = 'small_service_threshold'
  AND (dependencies IS NULL OR dependencies = '[]'::jsonb);

-- ============================================================================
-- STEP 3: Update mark_technician_busy_smart() to check enable_small_service
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_technician_busy_smart(p_employee_id uuid, p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_store_id uuid; v_threshold numeric; v_ticket_total numeric; v_current_status text; v_new_status text; v_small_service_enabled boolean;
BEGIN
  SELECT store_id INTO v_store_id FROM public.sale_tickets WHERE id = p_ticket_id;
  IF v_store_id IS NULL THEN RETURN; END IF;

  SELECT status INTO v_current_status FROM public.technician_ready_queue WHERE employee_id = p_employee_id AND store_id = v_store_id;
  IF v_current_status IS NULL THEN RETURN; END IF;
  IF v_current_status = 'busy' THEN
    UPDATE public.technician_ready_queue SET current_open_ticket_id = p_ticket_id, updated_at = now() WHERE employee_id = p_employee_id AND store_id = v_store_id;
    RETURN;
  END IF;

  -- Check if small service feature is enabled for this store
  SELECT COALESCE((setting_value)::boolean, true) INTO v_small_service_enabled
  FROM public.app_settings WHERE store_id = v_store_id AND setting_key = 'enable_small_service';
  IF v_small_service_enabled IS NULL THEN v_small_service_enabled := true; END IF;

  IF NOT v_small_service_enabled THEN
    -- Small service disabled: always go to busy
    UPDATE public.technician_ready_queue SET status = 'busy', current_open_ticket_id = p_ticket_id, updated_at = now()
    WHERE employee_id = p_employee_id AND store_id = v_store_id;
    RETURN;
  END IF;

  v_ticket_total := public.calculate_ticket_total(p_ticket_id);
  v_threshold := public.get_small_service_threshold(v_store_id);

  IF v_ticket_total < v_threshold THEN v_new_status := 'small_service'; ELSE v_new_status := 'busy'; END IF;
  IF v_current_status = 'small_service' AND v_ticket_total >= v_threshold THEN v_new_status := 'busy'; END IF;

  UPDATE public.technician_ready_queue SET status = v_new_status, current_open_ticket_id = p_ticket_id, updated_at = now()
  WHERE employee_id = p_employee_id AND store_id = v_store_id;
END;
$$;

-- ============================================================================
-- STEP 4: Trigger to clean up small_service entries when toggle is turned off
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_small_service_toggle()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Only act when enable_small_service is set to false
  IF NEW.setting_key = 'enable_small_service' AND NEW.setting_value::text = 'false' THEN
    UPDATE public.technician_ready_queue
    SET status = 'busy', updated_at = now()
    WHERE store_id = NEW.store_id AND status = 'small_service';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_small_service_toggle ON public.app_settings;
CREATE TRIGGER trg_handle_small_service_toggle
  AFTER UPDATE OF setting_value ON public.app_settings
  FOR EACH ROW
  WHEN (NEW.setting_key = 'enable_small_service')
  EXECUTE FUNCTION public.handle_small_service_toggle();

-- ============================================================================
-- STEP 5: Update add_missing_store_settings() to include enable_small_service
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

-- ============================================================================
-- STEP 6: Reload PostgREST schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';
