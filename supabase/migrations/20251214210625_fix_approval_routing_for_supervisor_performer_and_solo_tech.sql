/*
  # Fix Approval Routing for Supervisor Performer and Solo Technician

  ## Problem
  1. The trigger incorrectly routes ALL tickets where a Supervisor performed to Manager,
     even when a different person (like Receptionist) closed the ticket. This breaks
     separation of duties - Dion (Supervisor performer) should be able to approve
     tickets closed by Kelly (Receptionist).
  
  2. Solo Technicians who perform AND close a ticket alone should escalate to Supervisor,
     not auto-approve after deadline (no self-approval without oversight).

  ## Changes
  1. Remove lines 102-106 that route all supervisor-performed tickets to Manager
  2. Add condition: Solo Technician (only Tech role) performed AND closed alone → Supervisor approval
  3. Add condition: Solo Spa Expert (only Spa Expert role) performed AND closed alone → Supervisor approval

  ## New Approval Decision Tree
  | Scenario | Approval Level |
  |----------|----------------|
  | Supervisor performed AND closed alone | Manager |
  | Receptionist+Tech/SpaExpert dual-role performed AND closed alone | Supervisor |
  | Tech+Receptionist dual-role performed AND closed alone | Manager |
  | Solo Technician (only) performed AND closed alone | Supervisor |
  | Solo Spa Expert (only) performed AND closed alone | Supervisor |
  | Different people performed vs closed (separation of duties) | Technician (performer) |

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
  v_approval_minutes integer;
  v_closer_is_only_technician boolean;
  v_closer_is_only_spa_expert boolean;
BEGIN
  IF NEW.closed_at IS NOT NULL AND (OLD.closed_at IS NULL OR OLD.closed_at IS DISTINCT FROM NEW.closed_at) THEN
    
    NEW.approval_status := 'pending_approval';
    
    v_closer_roles := COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.closed_by_roles)),
      ARRAY[]::text[]
    );
    
    v_closer_is_receptionist := 'Receptionist' = ANY(v_closer_roles);
    v_closer_is_supervisor := 'Supervisor' = ANY(v_closer_roles);
    v_closer_is_technician := 'Technician' = ANY(v_closer_roles);
    v_closer_is_spa_expert := 'Spa Expert' = ANY(v_closer_roles);
    
    v_closer_is_only_technician := v_closer_is_technician 
      AND NOT v_closer_is_receptionist 
      AND NOT v_closer_is_supervisor 
      AND NOT v_closer_is_spa_expert;
    
    v_closer_is_only_spa_expert := v_closer_is_spa_expert 
      AND NOT v_closer_is_receptionist 
      AND NOT v_closer_is_supervisor 
      AND NOT v_closer_is_technician;
    
    SELECT 
      ARRAY_AGG(DISTINCT employee_id),
      COUNT(DISTINCT employee_id)
    INTO v_performers, v_performer_count
    FROM public.ticket_items
    WHERE sale_ticket_id = NEW.id;
    
    v_performers := COALESCE(v_performers, ARRAY[]::uuid[]);
    v_performer_count := COALESCE(v_performer_count, 0);
    
    v_closer_is_performer := (v_performer_count > 0 AND NEW.closed_by = ANY(v_performers));
    
    v_performed_and_closed := (v_performer_count = 1 AND v_closer_is_performer);
    
    -- APPROVAL ROUTING LOGIC
    -- Priority order matters - more specific conditions first
    
    -- 1. Supervisor performed AND closed alone → Manager
    IF v_closer_is_supervisor AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Supervisor performed and closed ticket themselves - requires Manager/Owner/Admin approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL;
      
    -- 2. Dual-role (Technician + Receptionist) performed AND closed alone → Manager
    ELSIF v_closer_is_technician AND v_closer_is_receptionist AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Employee with both Technician and Receptionist roles performed and closed - requires Manager approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL;
      
    -- 3. Receptionist with service role (Tech/Spa Expert) performed AND closed alone → Supervisor
    ELSIF v_closer_is_receptionist AND v_performed_and_closed AND 
          (v_closer_is_technician OR v_closer_is_spa_expert) THEN
      v_required_level := 'supervisor';
      v_reason := 'Receptionist with service role performed and closed ticket themselves - requires Supervisor approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL;
      
    -- 4. Solo Technician (only Tech role) performed AND closed alone → Supervisor
    ELSIF v_closer_is_only_technician AND v_performed_and_closed THEN
      v_required_level := 'supervisor';
      v_reason := 'Technician performed and closed ticket themselves - requires Supervisor approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL;
      
    -- 5. Solo Spa Expert (only Spa Expert role) performed AND closed alone → Supervisor
    ELSIF v_closer_is_only_spa_expert AND v_performed_and_closed THEN
      v_required_level := 'supervisor';
      v_reason := 'Spa Expert performed and closed ticket themselves - requires Supervisor approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL;
      
    -- 6. Different people performed vs closed (separation of duties exists)
    --    Performer can approve their own work since someone else closed it
    ELSE
      v_required_level := 'technician';
      v_reason := 'Standard ticket with separation of duties - performer can approve';
      NEW.requires_higher_approval := false;
      IF v_performer_count > 0 THEN
        NEW.approval_performer_id := v_performers[1];
      ELSE
        NEW.approval_performer_id := NULL;
      END IF;
    END IF;
    
    NEW.approval_required_level := v_required_level;
    NEW.approval_reason := v_reason;
    
    v_approval_minutes := public.get_auto_approval_minutes_by_level(NEW.store_id, v_required_level);
    
    NEW.approval_deadline := NEW.closed_at + (v_approval_minutes || ' minutes')::INTERVAL;
  END IF;
  
  RETURN NEW;
END;
$$;
