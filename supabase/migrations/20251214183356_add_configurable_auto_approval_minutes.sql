/*
  # Add Configurable Auto-Approval Time Period

  1. New Setting
    - `auto_approval_minutes` - Time in minutes before tickets are auto-approved
    - Default: 2880 minutes (48 hours)
    - Range: 10 minutes to 10080 minutes (7 days)
    
  2. Changes Made
    - Add auto_approval_minutes setting to all existing stores
    - Update set_approval_deadline() trigger to use dynamic value
    - Create function to update existing pending ticket deadlines
    - Create trigger to auto-update pending tickets when setting changes
    - Update help text for related settings
    
  3. Security
    - Maintains existing RLS policies
    - Uses SECURITY DEFINER for system functions
*/

-- Add the new setting to all existing stores
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
  'auto_approval_minutes',
  to_jsonb(2880), -- 48 hours default
  'Tickets',
  'Auto-approval time period',
  'Number of minutes before pending tickets are automatically approved',
  to_jsonb(2880),
  false,
  false,
  '[{"key": "auto_approve_after_48_hours", "type": "requires", "label": "Enable auto-approval"}]'::jsonb,
  25,
  'Set the time period (in minutes) before pending tickets are automatically approved. Range: 10 minutes to 10080 minutes (7 days). Default is 2880 minutes (48 hours).'
FROM public.stores s
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings 
  WHERE store_id = s.id 
  AND setting_key = 'auto_approval_minutes'
);

-- Update the auto_approve_after_48_hours help text to be more generic
UPDATE public.app_settings
SET 
  display_name = 'Enable auto-approval after deadline',
  help_text = 'Automatically approves tickets that have been pending past the configured approval deadline. The deadline is configurable via the "Auto-approval time period" setting.'
WHERE setting_key = 'auto_approve_after_48_hours';

-- Function to get auto-approval minutes for a store (with fallback to 48 hours)
CREATE OR REPLACE FUNCTION public.get_auto_approval_minutes(p_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_minutes integer;
  v_setting_value jsonb;
BEGIN
  SELECT setting_value
  INTO v_setting_value
  FROM public.app_settings
  WHERE store_id = p_store_id
  AND setting_key = 'auto_approval_minutes';
  
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

-- Update the trigger function to use dynamic approval deadline
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

    -- Get the auto-approval minutes for this store
    v_approval_minutes := public.get_auto_approval_minutes(NEW.store_id);

    -- Set basic approval fields with dynamic deadline
    NEW.approval_status := 'pending_approval';
    NEW.approval_deadline := NEW.closed_at + (v_approval_minutes || ' minutes')::INTERVAL;

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
  END IF;

  RETURN NEW;
END;
$$;

-- Function to update existing pending ticket deadlines when the setting changes
CREATE OR REPLACE FUNCTION public.update_pending_ticket_deadlines(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval_minutes integer;
  v_count integer;
  v_updated_tickets uuid[];
BEGIN
  -- Get the new approval minutes for this store
  v_approval_minutes := public.get_auto_approval_minutes(p_store_id);
  
  -- Update all pending tickets for this store
  WITH updated AS (
    UPDATE public.sale_tickets
    SET 
      approval_deadline = closed_at + (v_approval_minutes || ' minutes')::INTERVAL,
      updated_at = now()
    WHERE store_id = p_store_id
      AND approval_status = 'pending_approval'
      AND closed_at IS NOT NULL
    RETURNING id
  )
  SELECT array_agg(id), count(*)
  INTO v_updated_tickets, v_count
  FROM updated;
  
  RETURN jsonb_build_object(
    'success', true,
    'store_id', p_store_id,
    'updated_count', COALESCE(v_count, 0),
    'approval_minutes', v_approval_minutes,
    'message', format('Updated %s pending ticket(s) with new deadline', COALESCE(v_count, 0))
  );
END;
$$;

-- Trigger function to auto-update pending tickets when the setting changes
CREATE OR REPLACE FUNCTION public.handle_auto_approval_minutes_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only process if the auto_approval_minutes setting changed
  IF NEW.setting_key = 'auto_approval_minutes' AND 
     (OLD.setting_value IS DISTINCT FROM NEW.setting_value) THEN
    
    -- Update all pending tickets for this store
    v_result := public.update_pending_ticket_deadlines(NEW.store_id);
    
    -- Log the change
    RAISE NOTICE 'Auto-approval minutes changed for store %. Result: %', 
      NEW.store_id, v_result;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on app_settings to auto-update pending tickets
DROP TRIGGER IF EXISTS trigger_auto_approval_minutes_change ON public.app_settings;

CREATE TRIGGER trigger_auto_approval_minutes_change
  AFTER UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auto_approval_minutes_change();

-- Add check constraint to validate the minutes range
ALTER TABLE public.app_settings
DROP CONSTRAINT IF EXISTS check_auto_approval_minutes_range;

ALTER TABLE public.app_settings
ADD CONSTRAINT check_auto_approval_minutes_range
CHECK (
  setting_key != 'auto_approval_minutes' OR 
  (
    jsonb_typeof(setting_value) = 'number' AND
    (setting_value)::text::numeric >= 10 AND 
    (setting_value)::text::numeric <= 10080
  )
);

COMMENT ON FUNCTION public.get_auto_approval_minutes(uuid) IS 
'Returns the auto-approval minutes setting for a store with validation and fallback to 2880 (48 hours)';

COMMENT ON FUNCTION public.update_pending_ticket_deadlines(uuid) IS 
'Updates approval deadlines for all pending tickets in a store based on the current auto_approval_minutes setting';

COMMENT ON FUNCTION public.handle_auto_approval_minutes_change() IS 
'Trigger function that automatically updates pending ticket deadlines when auto_approval_minutes setting changes';
