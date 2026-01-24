/*
  # Fix Approval Deadline Function Column Names

  ## Problem
  The `set_approval_deadline()` function references incorrect column names:
  - Uses `requires_approval_level` but column is `approval_required_level`
  - Uses `approval_routing_reason` but column is `approval_reason`

  ## Changes
  1. Update `set_approval_deadline()` function to use correct column names

  ## Security
  - No RLS changes
  - Function maintains SECURITY INVOKER
*/

CREATE OR REPLACE FUNCTION public.set_approval_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
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
    
    -- Handle NULL array from ARRAY_AGG when no rows exist
    v_performers := COALESCE(v_performers, ARRAY[]::uuid[]);
    v_performer_count := COALESCE(v_performer_count, 0);
    
    -- Check if closer is one of the performers
    v_closer_is_performer := (v_performer_count > 0 AND NEW.closed_by = ANY(v_performers));
    
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
      -- Only set approval_performer_id if performers exist
      IF v_performer_count > 0 THEN
        NEW.approval_performer_id := v_performers[1];
      ELSE
        NEW.approval_performer_id := NULL;
      END IF;
    END IF;
    
    -- Use correct column names
    NEW.approval_required_level := v_required_level;
    NEW.approval_reason := v_reason;
    
    -- Get the appropriate auto-approval minutes based on the approval level
    v_approval_minutes := public.get_auto_approval_minutes_by_level(NEW.store_id, v_required_level);
    
    -- Set the deadline with the level-specific time period
    NEW.approval_deadline := NEW.closed_at + (v_approval_minutes || ' minutes')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$$;