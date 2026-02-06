/*
  # Fix Receptionist & Supervisor Ticket Approval Rules

  ## Changes

  ### set_approval_deadline() trigger
  - Simplify Receptionist self-service: any Receptionist who performs + closes
    requires Supervisor+ approval (removes dual-role edge cases)

  ### approve_ticket() RPC
  - Remove Receptionist from supervisor-level approval (Receptionist cannot
    approve supervisor-level tickets)
  - Require Receptionist and Supervisor to have worked on ticket for
    technician-level approval (same rule as Technician/Spa Expert)
*/

-- ============================================================================
-- FUNCTION: set_approval_deadline (patched trigger)
-- Replace the two Receptionist conditions with a single simpler one
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_approval_deadline()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_tips numeric;
  v_closer_roles text[];
  v_closer_is_receptionist boolean;
  v_closer_is_supervisor boolean;
  v_closer_is_technician boolean;
  v_closer_is_spa_expert boolean;
  v_closer_is_manager boolean;
  v_performers uuid[];
  v_performer_count int;
  v_closer_is_performer boolean;
  v_performed_and_closed boolean;
  v_required_level text;
  v_reason text;
  v_deadline_hours int;
BEGIN
  -- Only run when ticket transitions to closed
  IF NEW.status = 'closed' AND (OLD.status IS DISTINCT FROM 'closed') THEN

    -- Calculate total tips
    SELECT COALESCE(SUM(
      COALESCE(tip_customer_cash, 0) +
      COALESCE(tip_customer_card, 0) +
      COALESCE(tip_receptionist, 0)
    ), 0) INTO v_total_tips
    FROM public.ticket_items WHERE sale_ticket_id = NEW.id;

    -- Get closer roles
    v_closer_roles := COALESCE(ARRAY(SELECT jsonb_array_elements_text(NEW.closed_by_roles)), ARRAY[]::text[]);
    v_closer_is_receptionist := 'Receptionist' = ANY(v_closer_roles);
    v_closer_is_supervisor := 'Supervisor' = ANY(v_closer_roles);
    v_closer_is_technician := 'Technician' = ANY(v_closer_roles);
    v_closer_is_spa_expert := 'Spa Expert' = ANY(v_closer_roles);
    v_closer_is_manager := 'Manager' = ANY(v_closer_roles);

    SELECT ARRAY_AGG(DISTINCT employee_id), COUNT(DISTINCT employee_id)
    INTO v_performers, v_performer_count FROM public.ticket_items WHERE sale_ticket_id = NEW.id;

    v_closer_is_performer := NEW.closed_by = ANY(v_performers);
    v_performed_and_closed := (v_performer_count = 1 AND v_closer_is_performer);

    -- Approval routing logic
    IF v_total_tips > 20.00 THEN
      v_required_level := 'manager'; v_reason := format('Tips totaling $%s exceed $20 limit', ROUND(v_total_tips, 2)::text);
      NEW.requires_higher_approval := true;
    ELSIF v_closer_is_supervisor AND v_performed_and_closed THEN
      v_required_level := 'manager'; v_reason := 'Supervisor performed and closed ticket'; NEW.requires_higher_approval := true;
    ELSIF v_closer_is_manager AND v_performed_and_closed THEN
      v_required_level := 'owner'; v_reason := 'Manager performed and closed ticket'; NEW.requires_higher_approval := true;
    ELSIF v_closer_is_receptionist AND v_performed_and_closed THEN
      v_required_level := 'supervisor'; v_reason := 'Receptionist performed and closed ticket'; NEW.requires_higher_approval := true;
    ELSE
      v_required_level := 'technician'; v_reason := 'Standard technician peer approval'; NEW.requires_higher_approval := false;
    END IF;

    NEW.approval_required_level := v_required_level;
    NEW.approval_reason := v_reason;
    NEW.performed_and_closed_by_same_person := v_performed_and_closed;

    -- Set approval deadline
    SELECT COALESCE(
      (SELECT (value #>> '{}')::int FROM public.store_settings
       WHERE store_id = NEW.store_id AND key = 'approval_deadline_hours'),
      24
    ) INTO v_deadline_hours;

    NEW.approval_status := 'pending_approval';
    NEW.approval_deadline := NOW() + (v_deadline_hours || ' hours')::interval;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- FUNCTION: approve_ticket (updated — tighter Receptionist/Supervisor rules)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_ticket(p_ticket_id uuid, p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket public.sale_tickets; v_approver_roles text[];
  v_is_technician boolean; v_is_spa_expert boolean; v_is_supervisor boolean;
  v_is_receptionist boolean;
  v_is_manager boolean; v_is_owner boolean; v_is_admin boolean; v_worked_on_ticket boolean;
BEGIN
  SELECT * INTO v_ticket FROM public.sale_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Ticket not found'); END IF;
  IF v_ticket.approval_status != 'pending_approval' THEN RETURN json_build_object('success', false, 'message', 'Not pending approval'); END IF;
  IF v_ticket.closed_by = p_employee_id THEN RETURN json_build_object('success', false, 'message', 'Cannot approve ticket you closed'); END IF;

  SELECT role INTO v_approver_roles FROM public.employees WHERE id = p_employee_id;
  IF v_approver_roles IS NULL THEN RETURN json_build_object('success', false, 'message', 'Approver not found'); END IF;

  v_is_technician := 'Technician' = ANY(v_approver_roles);
  v_is_spa_expert := 'Spa Expert' = ANY(v_approver_roles);
  v_is_supervisor := 'Supervisor' = ANY(v_approver_roles);
  v_is_receptionist := 'Receptionist' = ANY(v_approver_roles);
  v_is_manager := 'Manager' = ANY(v_approver_roles);
  v_is_owner := 'Owner' = ANY(v_approver_roles);
  v_is_admin := 'Admin' = ANY(v_approver_roles);

  v_worked_on_ticket := EXISTS (SELECT 1 FROM public.ticket_items WHERE sale_ticket_id = p_ticket_id AND employee_id = p_employee_id);

  CASE v_ticket.approval_required_level
    WHEN 'owner' THEN
      IF NOT (v_is_admin OR v_is_owner) THEN
        RETURN json_build_object('success', false, 'message', format('Requires Admin/Owner approval: %s', v_ticket.approval_reason));
      END IF;
    WHEN 'manager' THEN
      IF NOT (v_is_manager OR v_is_owner OR v_is_admin) THEN
        RETURN json_build_object('success', false, 'message', format('Requires Manager+ approval: %s', v_ticket.approval_reason));
      END IF;
    WHEN 'supervisor' THEN
      -- Receptionist removed: cannot approve supervisor-level tickets
      IF v_is_supervisor THEN
        IF NOT v_worked_on_ticket THEN RETURN json_build_object('success', false, 'message', 'Supervisors must have performed service'); END IF;
      ELSIF NOT (v_is_manager OR v_is_owner OR v_is_admin) THEN
        RETURN json_build_object('success', false, 'message', format('Requires Supervisor+ approval: %s', v_ticket.approval_reason));
      END IF;
    WHEN 'technician' THEN
      -- Receptionist and Supervisor must also have worked on the ticket
      IF v_is_technician OR v_is_spa_expert OR v_is_receptionist OR v_is_supervisor THEN
        IF NOT v_worked_on_ticket THEN RETURN json_build_object('success', false, 'message', 'Must have worked on ticket to approve'); END IF;
      ELSIF NOT (v_is_manager OR v_is_owner OR v_is_admin) THEN
        RETURN json_build_object('success', false, 'message', 'No permission to approve tickets');
      END IF;
    ELSE RETURN json_build_object('success', false, 'message', 'Invalid approval level');
  END CASE;

  IF v_ticket.performed_and_closed_by_same_person AND v_worked_on_ticket THEN
    IF NOT (v_is_admin OR v_is_owner) THEN
      RETURN json_build_object('success', false, 'message', 'Cannot approve self-service ticket');
    END IF;
  END IF;

  UPDATE public.sale_tickets SET approval_status = 'approved', approved_at = NOW(), approved_by = p_employee_id, updated_at = NOW()
  WHERE id = p_ticket_id;

  RETURN json_build_object('success', true, 'message', 'Ticket approved');
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
