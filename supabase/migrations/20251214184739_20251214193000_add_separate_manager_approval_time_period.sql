/*
  # Add Separate Manager Approval Time Period

  1. New Setting
    - `auto_approval_minutes_manager` - Time in minutes before manager/admin tickets are auto-approved
    - Default: 2880 minutes (48 hours)
    - Range: 10 minutes to 10080 minutes (7 days)

  2. Changes Made
    - Add auto_approval_minutes_manager setting to all existing stores
    - Create function to get approval minutes based on approval level
    - Update set_approval_deadline() to use level-specific time periods
    - Update pending ticket deadline updater to handle both levels
    - Update trigger to handle changes to either setting

  3. Security
    - Maintains existing RLS policies
    - Uses SECURITY DEFINER for system functions
*/

-- Add the new manager-level setting to all existing stores
INSERT INTO public.app_settings (
  store_id,
  setting_key,
  setting_value,
  category,
  display_name,
  description,
  default_value,
  is_critical,
  requires_restart,
  dependencies,
  display_order,
  help_text
)
SELECT
  s.id,
  'auto_approval_minutes_manager',
  to_jsonb(2880), -- 48 hours default for manager approvals
  'Tickets',
  'Auto-approval time period (Manager/Admin)',
  'Number of minutes before manager/admin approval tickets are automatically approved',
  to_jsonb(2880),
  false,
  false,
  '[{"key": "auto_approve_after_48_hours", "type": "requires", "label": "Enable auto-approval"}]'::jsonb,
  26,
  'Set the time period (in minutes) before pending tickets requiring manager/admin approval are automatically approved. This applies to higher-level approvals. Range: 10 minutes to 10080 minutes (7 days). Default is 2880 minutes (48 hours).'
FROM public.stores s
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings
  WHERE store_id = s.id
  AND setting_key = 'auto_approval_minutes_manager'
);

-- Update the standard auto_approval_minutes setting to clarify it's for technician/supervisor level
UPDATE public.app_settings
SET
  display_name = 'Auto-approval time period (Standard)',
  description = 'Number of minutes before standard technician/supervisor approval tickets are automatically approved',
  help_text = 'Set the time period (in minutes) before pending tickets requiring standard (technician/supervisor) approval are automatically approved. Range: 10 minutes to 10080 minutes (7 days). Default is 2880 minutes (48 hours).'
WHERE setting_key = 'auto_approval_minutes';

-- Function to get auto-approval minutes based on approval level
CREATE OR REPLACE FUNCTION public.get_auto_approval_minutes_by_level(
  p_store_id uuid,
  p_approval_level text DEFAULT 'technician'
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_minutes integer;
  v_setting_value jsonb;
  v_setting_key text;
BEGIN
  -- Determine which setting to use based on approval level
  IF p_approval_level = 'manager' THEN
    v_setting_key := 'auto_approval_minutes_manager';
  ELSE
    v_setting_key := 'auto_approval_minutes';
  END IF;

  SELECT setting_value
  INTO v_setting_value
  FROM public.app_settings
  WHERE store_id = p_store_id
  AND setting_key = v_setting_key;

  -- Extract integer from JSONB
  IF v_setting_value IS NOT NULL THEN
    v_minutes := (v_setting_value)::text::integer;
  END IF;

  -- Fallback to 2880 (48 hours) if not found or invalid
  IF v_minutes IS NULL OR v_minutes < 10 OR v_minutes > 10080 THEN
    v_minutes := 2880;
  END IF;

  RETURN v_minutes;
END;
$$;

-- Update the trigger function to use level-specific approval deadlines
CREATE OR REPLACE FUNCTION public.set_approval_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_closer_roles text[];
  v_performers uuid[];
  v_performer_count int;
  v_closer_is_performer boolean;
  v_closer_is_receptionist boolean;
  v_closer_is_supervisor boolean;
  v_closer_is_technician boolean;
  v_closer_is_spa_expert boolean;
  v_required_level text;
  v_reason text;
  v_performed_and_closed boolean;
  v_supervisor_performer_id uuid;
  v_approval_minutes integer;
BEGIN
  -- Only process when ticket is being closed for the first time
  IF NEW.closed_at IS NOT NULL AND (OLD.closed_at IS NULL OR OLD.closed_at IS DISTINCT FROM NEW.closed_at) THEN

    -- Set basic approval fields (deadline will be set after determining level)
    NEW.approval_status := 'pending_approval';

    -- Get closer's roles
    v_closer_roles := COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.closed_by_roles)),
      ARRAY[]::text[]
    );

    -- Check closer's roles
    v_closer_is_receptionist := 'Receptionist' = ANY(v_closer_roles);
    v_closer_is_supervisor := 'Supervisor' = ANY(v_closer_roles);
    v_closer_is_technician := 'Technician' = ANY(v_closer_roles);
    v_closer_is_spa_expert := 'Spa Expert' = ANY(v_closer_roles);

    -- Get list of unique performers on this ticket
    SELECT
      ARRAY_AGG(DISTINCT employee_id),
      COUNT(DISTINCT employee_id)
    INTO v_performers, v_performer_count
    FROM public.ticket_items
    WHERE sale_ticket_id = NEW.id;

    -- Check if closer is one of the performers
    v_closer_is_performer := NEW.closed_by = ANY(v_performers);

    -- Check if this is a single-person ticket (one person did everything)
    v_performed_and_closed := (v_performer_count = 1 AND v_closer_is_performer);

    -- Check if a Supervisor performed the service (and get their ID)
    SELECT ti.employee_id INTO v_supervisor_performer_id
    FROM public.ticket_items ti
    INNER JOIN public.employees e ON ti.employee_id = e.id
    WHERE ti.sale_ticket_id = NEW.id
    AND 'Supervisor' = ANY(e.role)
    LIMIT 1;

    -- APPROVAL ROUTING LOGIC
    IF v_closer_is_supervisor AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Supervisor performed and closed ticket themselves - requires Manager/Owner/Admin approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL;

    ELSIF v_closer_is_receptionist AND v_performed_and_closed AND
          (v_closer_is_technician OR v_closer_is_spa_expert) THEN
      v_required_level := 'supervisor';
      v_reason := 'Receptionist with service role performed and closed ticket themselves - requires Supervisor approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL;

    ELSIF v_closer_is_technician AND v_closer_is_receptionist AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Employee with both Technician and Receptionist roles performed and closed - requires Manager approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL;

    ELSIF v_supervisor_performer_id IS NOT NULL THEN
      v_required_level := 'manager';
      v_reason := 'Supervisor performed service on ticket - requires Manager/Owner/Admin approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL;

    ELSE
      v_required_level := 'technician';
      v_reason := 'Standard ticket - requires technician approval';
      NEW.requires_higher_approval := false;
      NEW.approval_performer_id := v_performers[1];
    END IF;

    NEW.requires_approval_level := v_required_level;
    NEW.approval_routing_reason := v_reason;

    -- Get the appropriate auto-approval minutes based on the approval level
    v_approval_minutes := public.get_auto_approval_minutes_by_level(NEW.store_id, v_required_level);

    -- Set the deadline with the level-specific time period
    NEW.approval_deadline := NEW.closed_at + (v_approval_minutes || ' minutes')::INTERVAL;
  END IF;

  RETURN NEW;
END;
$$;

-- Update function to update existing pending ticket deadlines based on their approval level
CREATE OR REPLACE FUNCTION public.update_pending_ticket_deadlines(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval_minutes_standard integer;
  v_approval_minutes_manager integer;
  v_count_standard integer;
  v_count_manager integer;
  v_count_total integer;
BEGIN
  -- Get the approval minutes for both levels
  v_approval_minutes_standard := public.get_auto_approval_minutes_by_level(p_store_id, 'technician');
  v_approval_minutes_manager := public.get_auto_approval_minutes_by_level(p_store_id, 'manager');

  -- Update standard level tickets (technician/supervisor)
  WITH updated_standard AS (
    UPDATE public.sale_tickets
    SET
      approval_deadline = closed_at + (v_approval_minutes_standard || ' minutes')::INTERVAL,
      updated_at = now()
    WHERE store_id = p_store_id
      AND approval_status = 'pending_approval'
      AND closed_at IS NOT NULL
      AND requires_approval_level IN ('technician', 'supervisor')
    RETURNING id
  )
  SELECT count(*)
  INTO v_count_standard
  FROM updated_standard;

  -- Update manager level tickets
  WITH updated_manager AS (
    UPDATE public.sale_tickets
    SET
      approval_deadline = closed_at + (v_approval_minutes_manager || ' minutes')::INTERVAL,
      updated_at = now()
    WHERE store_id = p_store_id
      AND approval_status = 'pending_approval'
      AND closed_at IS NOT NULL
      AND requires_approval_level = 'manager'
    RETURNING id
  )
  SELECT count(*)
  INTO v_count_manager
  FROM updated_manager;

  v_count_total := COALESCE(v_count_standard, 0) + COALESCE(v_count_manager, 0);

  RETURN jsonb_build_object(
    'success', true,
    'store_id', p_store_id,
    'updated_count_total', v_count_total,
    'updated_count_standard', COALESCE(v_count_standard, 0),
    'updated_count_manager', COALESCE(v_count_manager, 0),
    'approval_minutes_standard', v_approval_minutes_standard,
    'approval_minutes_manager', v_approval_minutes_manager,
    'message', format('Updated %s pending ticket(s) with new deadlines (%s standard, %s manager)',
      v_count_total,
      COALESCE(v_count_standard, 0),
      COALESCE(v_count_manager, 0))
  );
END;
$$;

-- Update trigger function to auto-update pending tickets when either setting changes
CREATE OR REPLACE FUNCTION public.handle_auto_approval_minutes_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only process if auto_approval_minutes or auto_approval_minutes_manager setting changed
  IF NEW.setting_key IN ('auto_approval_minutes', 'auto_approval_minutes_manager') AND
     (OLD.setting_value IS DISTINCT FROM NEW.setting_value) THEN

    -- Update all pending tickets for this store
    v_result := public.update_pending_ticket_deadlines(NEW.store_id);

    -- Log the change
    RAISE NOTICE 'Auto-approval minutes changed for store % (setting: %). Result: %',
      NEW.store_id, NEW.setting_key, v_result;
  END IF;

  RETURN NEW;
END;
$$;

-- Add check constraint to validate the manager minutes range
ALTER TABLE public.app_settings
DROP CONSTRAINT IF EXISTS check_auto_approval_minutes_manager_range;

ALTER TABLE public.app_settings
ADD CONSTRAINT check_auto_approval_minutes_manager_range
CHECK (
  setting_key != 'auto_approval_minutes_manager' OR
  (
    jsonb_typeof(setting_value) = 'number' AND
    (setting_value)::text::numeric >= 10 AND
    (setting_value)::text::numeric <= 10080
  )
);

COMMENT ON FUNCTION public.get_auto_approval_minutes_by_level(uuid, text) IS
'Returns the auto-approval minutes setting for a store based on approval level (manager vs standard) with validation and fallback to 2880 (48 hours)';

COMMENT ON FUNCTION public.update_pending_ticket_deadlines(uuid) IS
'Updates approval deadlines for all pending tickets in a store based on their approval level and the corresponding auto_approval_minutes settings';

COMMENT ON FUNCTION public.handle_auto_approval_minutes_change() IS
'Trigger function that automatically updates pending ticket deadlines when auto_approval_minutes or auto_approval_minutes_manager setting changes';
