/*
  # Add Receptionist to Ticket Approval

  ## Overview
  Gives Receptionist the same ticket approval capabilities as Supervisor:
  - Can approve 'technician'-level tickets (without needing to have worked on them)
  - Can approve 'supervisor'-level tickets (only if they worked on the ticket)
  - Cannot approve 'manager' or 'owner'-level tickets
*/

-- ============================================================================
-- FUNCTION: approve_ticket (updated with Receptionist support)
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
      IF v_is_supervisor OR v_is_receptionist THEN
        IF NOT v_worked_on_ticket THEN RETURN json_build_object('success', false, 'message', 'Supervisors must have performed service'); END IF;
      ELSIF NOT (v_is_manager OR v_is_owner OR v_is_admin) THEN
        RETURN json_build_object('success', false, 'message', format('Requires Supervisor+ approval: %s', v_ticket.approval_reason));
      END IF;
    WHEN 'technician' THEN
      IF v_is_technician OR v_is_spa_expert THEN
        IF NOT v_worked_on_ticket THEN RETURN json_build_object('success', false, 'message', 'Must have worked on ticket to approve'); END IF;
      ELSIF NOT (v_is_receptionist OR v_is_supervisor OR v_is_manager OR v_is_owner OR v_is_admin) THEN
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
