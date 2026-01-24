/*
  # Fix Manager Self-Service Ticket Approval Routing

  ## Problem
  When a Manager opens, performs, AND closes a ticket themselves, these tickets
  should require Admin/Owner approval (not Manager). Currently, they fall through
  to the ELSE clause and get assigned `approval_required_level = 'technician'`.

  ## Solution
  1. Introduce new `'owner'` approval level for Manager self-service tickets
  2. Only Admin and Owner can approve 'owner' level tickets (Manager excluded)
  3. Update all relevant functions to handle the new level

  ## Changes
  1. Update `set_approval_deadline()` trigger - add Manager check with 'owner' level
  2. Update `approve_ticket()` function - add 'owner' CASE
  3. Update `get_pending_approvals_for_management()` - include 'owner' level
  4. Backfill existing pending tickets

  ## Updated Approval Decision Tree
  | Scenario | Approval Level | Who Can Approve |
  |----------|----------------|-----------------|
  | High tips (> $20) | manager | Manager, Owner, Admin |
  | Supervisor performed AND closed alone | manager | Manager, Owner, Admin |
  | Manager performed AND closed alone | owner | Admin, Owner ONLY |
  | Receptionist+Tech dual-role performed AND closed alone | supervisor | Supervisor+ |
  | Tech+Receptionist dual-role performed AND closed alone | manager | Manager, Owner, Admin |
  | Standard (separation of duties) | technician | Performer |
*/

-- ============================================================================
-- PART 1: UPDATE set_approval_deadline() TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION set_approval_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
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
  v_closer_is_manager boolean;  -- NEW: Manager role check
  v_required_level text;
  v_reason text;
  v_performed_and_closed boolean;
  v_total_tips numeric;
BEGIN
  IF NEW.closed_at IS NOT NULL AND (OLD.closed_at IS NULL OR OLD.closed_at IS DISTINCT FROM NEW.closed_at) THEN

    NEW.approval_status := 'pending_approval';
    NEW.approval_deadline := NEW.closed_at + INTERVAL '48 hours';

    -- Calculate total tips for this ticket
    SELECT COALESCE(SUM(
      COALESCE(tip_customer_cash, 0) +
      COALESCE(tip_customer_card, 0) +
      COALESCE(tip_receptionist, 0)
    ), 0)
    INTO v_total_tips
    FROM ticket_items
    WHERE sale_ticket_id = NEW.id;

    -- Get closer's roles
    v_closer_roles := COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.closed_by_roles)),
      ARRAY[]::text[]
    );

    v_closer_is_receptionist := 'Receptionist' = ANY(v_closer_roles);
    v_closer_is_supervisor := 'Supervisor' = ANY(v_closer_roles);
    v_closer_is_technician := 'Technician' = ANY(v_closer_roles);
    v_closer_is_spa_expert := 'Spa Expert' = ANY(v_closer_roles);
    v_closer_is_manager := 'Manager' = ANY(v_closer_roles);  -- NEW

    -- Get performers
    SELECT
      ARRAY_AGG(DISTINCT employee_id),
      COUNT(DISTINCT employee_id)
    INTO v_performers, v_performer_count
    FROM ticket_items
    WHERE sale_ticket_id = NEW.id;

    v_closer_is_performer := NEW.closed_by = ANY(v_performers);
    v_performed_and_closed := (v_performer_count = 1 AND v_closer_is_performer);

    -- APPROVAL ROUTING LOGIC (priority order)

    -- 1. HIGH TIP CHECK: If tips exceed $20, require management approval
    IF v_total_tips > 20.00 THEN
      v_required_level := 'manager';
      v_reason := format('Ticket has tips totaling $%s (exceeds $20 limit) - requires Manager/Admin approval',
                        ROUND(v_total_tips, 2)::text);
      NEW.requires_higher_approval := true;

    -- 2. Supervisor performed AND closed alone → Manager approval
    ELSIF v_closer_is_supervisor AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Supervisor performed service and closed ticket themselves - requires Manager/Admin approval';
      NEW.requires_higher_approval := true;

    -- 3. NEW: Manager performed AND closed alone → Owner/Admin approval ONLY
    ELSIF v_closer_is_manager AND v_performed_and_closed THEN
      v_required_level := 'owner';  -- NEW LEVEL: Only Admin/Owner can approve
      v_reason := 'Manager performed service and closed ticket themselves - requires Admin/Owner approval';
      NEW.requires_higher_approval := true;

    -- 4. Receptionist with service role performed AND closed alone → Supervisor
    ELSIF v_closer_is_receptionist AND v_performed_and_closed AND
          (v_closer_is_technician OR v_closer_is_spa_expert) THEN
      v_required_level := 'supervisor';
      v_reason := 'Receptionist performed service and closed ticket themselves - requires Supervisor approval';
      NEW.requires_higher_approval := true;

    -- 5. Dual-role (Technician + Receptionist) performed AND closed alone → Manager
    ELSIF v_closer_is_technician AND v_closer_is_receptionist AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Employee with both Technician and Receptionist roles performed and closed ticket - requires Manager/Admin approval';
      NEW.requires_higher_approval := true;

    -- 6. Standard case: Different people performed vs closed (separation of duties exists)
    ELSE
      v_required_level := 'technician';
      v_reason := 'Standard technician peer approval';
      NEW.requires_higher_approval := false;
    END IF;

    NEW.approval_required_level := v_required_level;
    NEW.approval_reason := v_reason;
    NEW.performed_and_closed_by_same_person := v_performed_and_closed;

  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 2: UPDATE approve_ticket() FUNCTION - Add 'owner' level case
-- ============================================================================

CREATE OR REPLACE FUNCTION approve_ticket(
  p_ticket_id uuid,
  p_employee_id uuid
)
RETURNS json
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket sale_tickets;
  v_approver_roles text[];
  v_is_technician boolean;
  v_is_spa_expert boolean;
  v_is_supervisor boolean;
  v_is_manager boolean;
  v_is_owner boolean;
  v_is_admin boolean;  -- NEW: Admin role check
  v_worked_on_ticket boolean;
BEGIN
  -- Get the ticket
  SELECT * INTO v_ticket FROM sale_tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Ticket not found');
  END IF;

  -- Check if ticket is in pending_approval status
  IF v_ticket.approval_status != 'pending_approval' THEN
    RETURN json_build_object('success', false, 'message', 'Ticket is not pending approval');
  END IF;

  -- Check if approver is different from closer (NEVER allow closer to approve)
  IF v_ticket.closed_by = p_employee_id THEN
    RETURN json_build_object('success', false, 'message', 'You cannot approve a ticket you closed');
  END IF;

  -- Get approver's roles
  SELECT role INTO v_approver_roles FROM employees WHERE id = p_employee_id;

  IF v_approver_roles IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Approver not found');
  END IF;

  -- Check approver's role levels
  v_is_technician := 'Technician' = ANY(v_approver_roles);
  v_is_spa_expert := 'Spa Expert' = ANY(v_approver_roles);
  v_is_supervisor := 'Supervisor' = ANY(v_approver_roles);
  v_is_manager := 'Manager' = ANY(v_approver_roles);
  v_is_owner := 'Owner' = ANY(v_approver_roles);
  v_is_admin := 'Admin' = ANY(v_approver_roles);  -- NEW

  -- Check if approver worked on this ticket
  v_worked_on_ticket := EXISTS (
    SELECT 1 FROM ticket_items
    WHERE sale_ticket_id = p_ticket_id AND employee_id = p_employee_id
  );

  -- Apply approval rules based on required level
  CASE v_ticket.approval_required_level

    -- NEW: OWNER/ADMIN LEVEL REQUIRED (Manager performed AND closed themselves)
    -- Only Admin or Owner can approve - Manager is explicitly excluded
    WHEN 'owner' THEN
      IF NOT (v_is_admin OR v_is_owner) THEN
        RETURN json_build_object(
          'success', false,
          'message', format('This ticket requires Admin or Owner approval. Reason: %s', v_ticket.approval_reason)
        );
      END IF;

    -- MANAGER/OWNER LEVEL REQUIRED (Supervisor performed AND closed, or high tips)
    WHEN 'manager' THEN
      IF NOT (v_is_manager OR v_is_owner OR v_is_admin) THEN
        RETURN json_build_object(
          'success', false,
          'message', format('This ticket requires Manager or Owner approval. Reason: %s', v_ticket.approval_reason)
        );
      END IF;

    -- SUPERVISOR LEVEL REQUIRED (Supervisor performed, Receptionist closed)
    WHEN 'supervisor' THEN
      -- Supervisor must have performed the work to approve
      IF v_is_supervisor THEN
        IF NOT v_worked_on_ticket THEN
          RETURN json_build_object(
            'success', false,
            'message', 'Supervisors can only approve tickets where they performed the service'
          );
        END IF;
      -- Or higher level (Manager/Owner/Admin) can also approve
      ELSIF NOT (v_is_manager OR v_is_owner OR v_is_admin) THEN
        RETURN json_build_object(
          'success', false,
          'message', format('This ticket requires Supervisor or higher approval. Reason: %s', v_ticket.approval_reason)
        );
      END IF;

    -- TECHNICIAN LEVEL REQUIRED (standard peer approval)
    WHEN 'technician' THEN
      -- Technician/Spa Expert must have worked on the ticket
      IF v_is_technician OR v_is_spa_expert THEN
        IF NOT v_worked_on_ticket THEN
          RETURN json_build_object(
            'success', false,
            'message', 'You must have worked on this ticket to approve it'
          );
        END IF;
      -- Or higher level (Supervisor/Manager/Owner/Admin) can also approve
      ELSIF NOT (v_is_supervisor OR v_is_manager OR v_is_owner OR v_is_admin) THEN
        RETURN json_build_object(
          'success', false,
          'message', 'You do not have permission to approve tickets'
        );
      END IF;

    ELSE
      RETURN json_build_object('success', false, 'message', 'Invalid approval level configuration');
  END CASE;

  -- Additional safety check: If performer and closer are the same person, they cannot approve
  IF v_ticket.performed_and_closed_by_same_person AND v_worked_on_ticket THEN
    -- Only Admin/Owner can approve self-service tickets
    IF NOT (v_is_admin OR v_is_owner) THEN
      RETURN json_build_object(
        'success', false,
        'message', 'You cannot approve this ticket because you both performed the service and closed it'
      );
    END IF;
  END IF;

  -- Approve the ticket
  UPDATE sale_tickets
  SET
    approval_status = 'approved',
    approved_at = NOW(),
    approved_by = p_employee_id,
    updated_at = NOW()
  WHERE id = p_ticket_id;

  RETURN json_build_object('success', true, 'message', 'Ticket approved successfully');
END;
$$;

-- ============================================================================
-- PART 3: UPDATE get_pending_approvals_for_management() - Include 'owner' level
-- ============================================================================

DROP FUNCTION IF EXISTS get_pending_approvals_for_management(uuid);
DROP FUNCTION IF EXISTS public.get_pending_approvals_for_management(uuid);

CREATE FUNCTION public.get_pending_approvals_for_management(
  p_store_id uuid
)
RETURNS TABLE (
  ticket_id uuid,
  ticket_no text,
  ticket_date date,
  closed_at timestamptz,
  approval_deadline timestamptz,
  customer_name text,
  customer_phone text,
  total numeric,
  closed_by_name text,
  closed_by_roles jsonb,
  hours_remaining numeric,
  service_name text,
  tip_customer numeric,
  tip_receptionist numeric,
  payment_method text,
  requires_higher_approval boolean,
  technician_names text,
  reason text,
  completed_by_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id as ticket_id,
    st.ticket_no,
    st.ticket_date,
    st.closed_at,
    st.approval_deadline,
    st.customer_name,
    st.customer_phone,
    st.total,
    COALESCE(e.display_name, 'Unknown') as closed_by_name,
    st.closed_by_roles,
    EXTRACT(EPOCH FROM (st.approval_deadline - NOW())) / 3600 as hours_remaining,
    STRING_AGG(DISTINCT s.name, ', ') as service_name,
    SUM(ti.tip_customer_cash + ti.tip_customer_card) as tip_customer,
    SUM(ti.tip_receptionist) as tip_receptionist,
    st.payment_method,
    COALESCE(st.requires_higher_approval, false) as requires_higher_approval,
    STRING_AGG(DISTINCT emp.display_name, ', ') as technician_names,
    COALESCE(st.approval_reason, 'Requires management review') as reason,
    COALESCE(completed_emp.display_name, 'N/A') as completed_by_name
  FROM public.sale_tickets st
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.employees completed_emp ON st.completed_by = completed_emp.id
  LEFT JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.store_services s ON ti.store_service_id = s.id
  LEFT JOIN public.employees emp ON ti.employee_id = emp.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    -- Include tickets requiring manager OR owner approval
    AND st.approval_required_level IN ('manager', 'owner')
  GROUP BY st.id, e.display_name, completed_emp.display_name
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- Set search_path for security
ALTER FUNCTION public.get_pending_approvals_for_management(p_store_id uuid) SET search_path = '';

-- Add comment
COMMENT ON FUNCTION public.get_pending_approvals_for_management IS
'Returns management-level approval tickets including both manager and owner level approvals.
Owner level tickets (Manager self-service) can only be approved by Admin/Owner.';

-- ============================================================================
-- PART 4: BACKFILL EXISTING PENDING TICKETS
-- ============================================================================

DO $$
DECLARE
  v_ticket RECORD;
  v_closer_roles text[];
  v_performers uuid[];
  v_performer_count int;
  v_closer_is_performer boolean;
  v_closer_is_receptionist boolean;
  v_closer_is_supervisor boolean;
  v_closer_is_technician boolean;
  v_closer_is_spa_expert boolean;
  v_closer_is_manager boolean;
  v_required_level text;
  v_reason text;
  v_performed_and_closed boolean;
  v_total_tips numeric;
  v_updated_count int := 0;
BEGIN
  RAISE NOTICE 'Starting Manager self-service approval backfill for pending tickets...';

  FOR v_ticket IN
    SELECT id, closed_by, closed_by_roles
    FROM sale_tickets
    WHERE approval_status = 'pending_approval'
      AND closed_at IS NOT NULL
  LOOP
    -- Calculate total tips
    SELECT COALESCE(SUM(
      COALESCE(tip_customer_cash, 0) +
      COALESCE(tip_customer_card, 0) +
      COALESCE(tip_receptionist, 0)
    ), 0)
    INTO v_total_tips
    FROM ticket_items
    WHERE sale_ticket_id = v_ticket.id;

    -- Get closer's roles
    v_closer_roles := COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(v_ticket.closed_by_roles)),
      ARRAY[]::text[]
    );

    -- Fallback: get roles from employees table if not stored
    IF array_length(v_closer_roles, 1) IS NULL THEN
      SELECT role INTO v_closer_roles
      FROM employees
      WHERE id = v_ticket.closed_by;
    END IF;

    v_closer_is_receptionist := 'Receptionist' = ANY(v_closer_roles);
    v_closer_is_supervisor := 'Supervisor' = ANY(v_closer_roles);
    v_closer_is_technician := 'Technician' = ANY(v_closer_roles);
    v_closer_is_spa_expert := 'Spa Expert' = ANY(v_closer_roles);
    v_closer_is_manager := 'Manager' = ANY(v_closer_roles);

    -- Get performers
    SELECT
      ARRAY_AGG(DISTINCT employee_id),
      COUNT(DISTINCT employee_id)
    INTO v_performers, v_performer_count
    FROM ticket_items
    WHERE sale_ticket_id = v_ticket.id;

    v_closer_is_performer := v_ticket.closed_by = ANY(v_performers);
    v_performed_and_closed := (v_performer_count = 1 AND v_closer_is_performer);

    -- Apply approval logic (matching trigger logic)
    IF v_total_tips > 20.00 THEN
      v_required_level := 'manager';
      v_reason := format('Ticket has tips totaling $%s (exceeds $20 limit) - requires Manager/Admin approval',
                        ROUND(v_total_tips, 2)::text);

    ELSIF v_closer_is_supervisor AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Supervisor performed service and closed ticket themselves - requires Manager/Admin approval';

    -- NEW: Manager self-service check → 'owner' level
    ELSIF v_closer_is_manager AND v_performed_and_closed THEN
      v_required_level := 'owner';
      v_reason := 'Manager performed service and closed ticket themselves - requires Admin/Owner approval';

    ELSIF v_closer_is_receptionist AND v_performed_and_closed AND
          (v_closer_is_technician OR v_closer_is_spa_expert) THEN
      v_required_level := 'supervisor';
      v_reason := 'Receptionist performed service and closed ticket themselves - requires Supervisor approval';

    ELSIF v_closer_is_technician AND v_closer_is_receptionist AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Employee with both Technician and Receptionist roles performed and closed ticket - requires Manager/Admin approval';

    ELSE
      v_required_level := 'technician';
      v_reason := 'Standard technician peer approval';
    END IF;

    -- Update the ticket if routing changed
    UPDATE sale_tickets
    SET
      approval_required_level = v_required_level,
      approval_reason = v_reason,
      performed_and_closed_by_same_person = v_performed_and_closed,
      requires_higher_approval = (v_required_level != 'technician')
    WHERE id = v_ticket.id
      AND (
        approval_required_level IS DISTINCT FROM v_required_level
        OR approval_reason IS DISTINCT FROM v_reason
        OR performed_and_closed_by_same_person IS DISTINCT FROM v_performed_and_closed
      );

    IF FOUND THEN
      v_updated_count := v_updated_count + 1;
    END IF;

  END LOOP;

  RAISE NOTICE 'Updated % pending approval tickets with Manager self-service check', v_updated_count;
END $$;

-- ============================================================================
-- PART 5: ADD COMMENTS
-- ============================================================================

COMMENT ON FUNCTION set_approval_deadline IS
'Trigger function that sets approval routing when ticket is closed. Checks for:
1. High tips (>$20) - requires Manager/Admin approval
2. Supervisor self-service - requires Manager/Admin approval
3. Manager self-service - requires Admin/Owner approval ONLY (new ''owner'' level)
4. Dual-role conflicts - requires appropriate escalation
5. Standard separation of duties - technician peer approval';

COMMENT ON FUNCTION approve_ticket IS
'Approves a ticket with role-based validation. Supports four approval levels:
- owner: Only Admin or Owner can approve (for Manager self-service tickets)
- manager: Manager, Owner, or Admin can approve
- supervisor: Supervisor (who performed) or higher can approve
- technician: Performer (who worked on ticket) or higher can approve';
