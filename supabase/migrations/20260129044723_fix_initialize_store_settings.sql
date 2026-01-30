/*
  # Fix initialize_store_settings Function

  ## Overview
  Fixes the initialize_store_settings function to:
  1. Accept optional p_preset parameter (for API compatibility)
  2. Return proper JSON result {success, message} for frontend compatibility
  3. Creates helper function add_missing_store_settings() for adding missing settings to existing stores

  ## Changes
  - Updates initialize_store_settings(p_store_id, p_preset) to return JSON
  - Creates add_missing_store_settings() helper function
  - Adds all missing settings to ALL existing stores

  ## Settings (Per-Store) - Uses existing naming conventions
  | Key | Category | Description |
  |-----|----------|-------------|
  | store_timezone | System | Store timezone |
  | auto_approval_minutes | System | Auto-approval timeout (2880 = 48h) |
  | auto_approval_minutes_manager | System | Manager approval timeout |
  | require_todays_color | Tickets | Require color for customers |
  | require_customer_name_on_tickets | Tickets | Require customer name |
  | require_customer_phone_on_tickets | Tickets | Require customer phone |
  | small_service_threshold | Operations | Small service $ threshold |

  ## Note
  Branding and Storage settings are now in app_global_settings table (global, not per-store).
  The check_setting_value_is_primitive constraint only allows boolean/number/string/null values.
*/

-- ============================================================================
-- FUNCTION: add_missing_store_settings
-- Helper function to add any missing settings to a store
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_missing_store_settings(p_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_added_count integer := 0;
BEGIN
  -- Store Timezone (System category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'store_timezone', '"America/New_York"', '"America/New_York"', 'System', 'Store Timezone', 'Store timezone for date/time operations', 1)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Auto-approval minutes (System category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'auto_approval_minutes', '2880', '2880', 'System', 'Auto-Approval Minutes', 'Minutes before tickets are auto-approved (default 48 hours)', 2)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Manager approval minutes (System category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'auto_approval_minutes_manager', '2880', '2880', 'System', 'Manager Approval Minutes', 'Minutes before manager-level tickets are auto-approved', 3)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Ticket Approval System enabled (Tickets category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_ticket_approval_system', 'true', 'true', 'Tickets', 'Enable Ticket Approval', 'Enable the ticket approval workflow', 1)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Auto approve after 48 hours (Tickets category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'auto_approve_after_48_hours', 'true', 'true', 'Tickets', 'Auto-Approve After 48 Hours', 'Automatically approve tickets after 48 hours', 2)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Require color for customers (Tickets category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_todays_color', 'false', 'false', 'Tickets', 'Require Today Color', 'Require color entry for returning customers', 3)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Require customer name (Tickets category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_customer_name_on_tickets', 'false', 'false', 'Tickets', 'Require Customer Name', 'Require customer name on tickets', 4)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Require customer phone (Tickets category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_customer_phone_on_tickets', 'false', 'false', 'Tickets', 'Require Customer Phone', 'Require customer phone on tickets', 5)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Admin review rejected tickets (Tickets category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'admin_review_rejected_tickets', 'false', 'false', 'Tickets', 'Admin Review Rejected', 'Require admin review for rejected tickets', 6)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Enable ready queue (Operations category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_ready_queue', 'true', 'true', 'Operations', 'Enable Ready Queue', 'Enable the technician ready queue', 1)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Show queue button in header (Operations category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'show_queue_button_in_header', 'true', 'true', 'Operations', 'Show Queue Button', 'Show queue button in header', 2)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Small service threshold (Operations category) - stored as number
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'small_service_threshold', '30', '30', 'Operations', 'Small Service Threshold', 'Ticket total below this amount is considered a small service', 3)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Require opening cash validation (Payment category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'require_opening_cash_validation', 'true', 'true', 'Payment', 'Require Opening Cash', 'Require opening cash count before tickets', 1)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  -- Enable approval deadline warnings (Notifications category)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
  VALUES (p_store_id, 'enable_approval_deadline_warnings', 'true', 'true', 'Notifications', 'Approval Deadline Warnings', 'Show warnings for pending approvals', 1)
  ON CONFLICT (store_id, setting_key) DO NOTHING;
  IF FOUND THEN v_added_count := v_added_count + 1; END IF;

  RETURN v_added_count;
END;
$$;

-- ============================================================================
-- FUNCTION: initialize_store_settings (FIXED - accepts p_preset, returns JSON)
-- ============================================================================
DROP FUNCTION IF EXISTS public.initialize_store_settings(uuid);
DROP FUNCTION IF EXISTS public.initialize_store_settings(uuid, text);

CREATE OR REPLACE FUNCTION public.initialize_store_settings(
  p_store_id uuid,
  p_preset text DEFAULT 'full'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_added_count integer := 0;
BEGIN
  -- Note: p_preset is accepted for API compatibility but all stores get full settings
  -- The "preset" concept was removed - all stores always get all settings

  -- Use the helper function to add all settings
  v_added_count := public.add_missing_store_settings(p_store_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Store settings initialized with %s settings', v_added_count)
  );
END;
$$;

-- ============================================================================
-- ADD MISSING SETTINGS TO ALL EXISTING STORES
-- ============================================================================

-- Store Timezone for all stores (System category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'store_timezone',
  '"America/New_York"'::jsonb,
  '"America/New_York"'::jsonb,
  'System',
  'Store Timezone',
  'Store timezone for date/time operations',
  1
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'store_timezone'
);

-- Auto-approval minutes for all stores (System category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'auto_approval_minutes',
  '2880'::jsonb,
  '2880'::jsonb,
  'System',
  'Auto-Approval Minutes',
  'Minutes before tickets are auto-approved (default 48 hours)',
  2
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'auto_approval_minutes'
);

-- Manager approval minutes for all stores (System category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'auto_approval_minutes_manager',
  '2880'::jsonb,
  '2880'::jsonb,
  'System',
  'Manager Approval Minutes',
  'Minutes before manager-level tickets are auto-approved',
  3
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'auto_approval_minutes_manager'
);

-- Enable ticket approval system for all stores (Tickets category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'enable_ticket_approval_system',
  'true'::jsonb,
  'true'::jsonb,
  'Tickets',
  'Enable Ticket Approval',
  'Enable the ticket approval workflow',
  1
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'enable_ticket_approval_system'
);

-- Auto approve after 48 hours for all stores (Tickets category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'auto_approve_after_48_hours',
  'true'::jsonb,
  'true'::jsonb,
  'Tickets',
  'Auto-Approve After 48 Hours',
  'Automatically approve tickets after 48 hours',
  2
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'auto_approve_after_48_hours'
);

-- Require today color for all stores (Tickets category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'require_todays_color',
  'false'::jsonb,
  'false'::jsonb,
  'Tickets',
  'Require Today Color',
  'Require color entry for returning customers',
  3
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'require_todays_color'
);

-- Require customer name for all stores (Tickets category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'require_customer_name_on_tickets',
  'false'::jsonb,
  'false'::jsonb,
  'Tickets',
  'Require Customer Name',
  'Require customer name on tickets',
  4
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'require_customer_name_on_tickets'
);

-- Require customer phone for all stores (Tickets category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'require_customer_phone_on_tickets',
  'false'::jsonb,
  'false'::jsonb,
  'Tickets',
  'Require Customer Phone',
  'Require customer phone on tickets',
  5
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'require_customer_phone_on_tickets'
);

-- Admin review rejected tickets for all stores (Tickets category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'admin_review_rejected_tickets',
  'false'::jsonb,
  'false'::jsonb,
  'Tickets',
  'Admin Review Rejected',
  'Require admin review for rejected tickets',
  6
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'admin_review_rejected_tickets'
);

-- Enable ready queue for all stores (Operations category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'enable_ready_queue',
  'true'::jsonb,
  'true'::jsonb,
  'Operations',
  'Enable Ready Queue',
  'Enable the technician ready queue',
  1
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'enable_ready_queue'
);

-- Show queue button in header for all stores (Operations category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'show_queue_button_in_header',
  'true'::jsonb,
  'true'::jsonb,
  'Operations',
  'Show Queue Button',
  'Show queue button in header',
  2
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'show_queue_button_in_header'
);

-- Small service threshold for all stores (Operations category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'small_service_threshold',
  '30'::jsonb,
  '30'::jsonb,
  'Operations',
  'Small Service Threshold',
  'Ticket total below this amount is considered a small service',
  3
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'small_service_threshold'
);

-- Require opening cash validation for all stores (Payment category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'require_opening_cash_validation',
  'true'::jsonb,
  'true'::jsonb,
  'Payment',
  'Require Opening Cash',
  'Require opening cash count before tickets',
  1
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'require_opening_cash_validation'
);

-- Enable approval deadline warnings for all stores (Notifications category)
INSERT INTO public.app_settings (store_id, setting_key, setting_value, default_value, category, display_name, description, display_order)
SELECT
  id,
  'enable_approval_deadline_warnings',
  'true'::jsonb,
  'true'::jsonb,
  'Notifications',
  'Approval Deadline Warnings',
  'Show warnings for pending approvals',
  1
FROM public.stores
WHERE id NOT IN (
  SELECT store_id FROM public.app_settings WHERE setting_key = 'enable_approval_deadline_warnings'
);

-- ============================================================================
-- ENSURE GLOBAL SETTINGS EXIST
-- ============================================================================
-- Call initialize_global_settings to ensure all global settings exist
SELECT public.initialize_global_settings();

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
