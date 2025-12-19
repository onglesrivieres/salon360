/*
  # Add Management Approval for High-Tip Tickets

  ## Overview
  This migration adds a business rule requiring management approval for any ticket
  where the total tips exceed $20. This applies to all tip types:
  - tip_customer_cash (cash tips from customer)
  - tip_customer_card (card tips from customer)
  - tip_receptionist (tips for receptionist/pairing)

  ## Changes
  1. Update `set_approval_deadline()` trigger to calculate total tips and require
     management approval when tips exceed $20
  2. Update `get_pending_approvals_for_management()` to include high-tip tickets
  3. Backfill existing pending tickets to apply the new rule

  ## Business Rules
  - Any ticket with total tips > $20.00 requires Manager/Admin approval
  - Tickets with exactly $20.00 or less follow standard approval routing
  - High-tip approval requirement applies in addition to conflict-of-interest rules
  - These tickets will show in the management approval queue with a clear reason
*/

-- ============================================================================
-- PART 1: UPDATE TRIGGER TO CHECK FOR HIGH TIPS
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

    -- Get performers
    SELECT
      ARRAY_AGG(DISTINCT employee_id),
      COUNT(DISTINCT employee_id)
    INTO v_performers, v_performer_count
    FROM ticket_items
    WHERE sale_ticket_id = NEW.id;

    v_closer_is_performer := NEW.closed_by = ANY(v_performers);
    v_performed_and_closed := (v_performer_count = 1 AND v_closer_is_performer);

    -- HIGH TIP CHECK: If tips exceed $20, require management approval
    IF v_total_tips > 20.00 THEN
      v_required_level := 'manager';
      v_reason := format('Ticket has tips totaling $%s (exceeds $20 limit) - requires Manager/Admin approval',
                        ROUND(v_total_tips, 2)::text);
      NEW.requires_higher_approval := true;

    -- Conflict of interest checks (existing logic)
    ELSIF v_closer_is_supervisor AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Supervisor performed service and closed ticket themselves - requires Manager/Admin approval';
      NEW.requires_higher_approval := true;

    ELSIF v_closer_is_receptionist AND v_performed_and_closed AND
          (v_closer_is_technician OR v_closer_is_spa_expert) THEN
      v_required_level := 'supervisor';
      v_reason := 'Receptionist performed service and closed ticket themselves - requires Supervisor approval';
      NEW.requires_higher_approval := true;

    ELSIF v_closer_is_technician AND v_closer_is_receptionist AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Employee with both Technician and Receptionist roles performed and closed ticket - requires Manager/Admin approval';
      NEW.requires_higher_approval := true;

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
-- PART 2: UPDATE MANAGEMENT APPROVAL FUNCTION TO INCLUDE HIGH-TIP TICKETS
-- ============================================================================

-- Drop the old function first to allow signature change
DROP FUNCTION IF EXISTS get_pending_approvals_for_management(uuid);

CREATE OR REPLACE FUNCTION get_pending_approvals_for_management(
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
SET search_path = public, pg_temp
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
  FROM sale_tickets st
  LEFT JOIN employees e ON st.closed_by = e.id
  LEFT JOIN employees completed_emp ON st.completed_by = completed_emp.id
  LEFT JOIN ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN store_services s ON ti.store_service_id = s.id
  LEFT JOIN employees emp ON ti.employee_id = emp.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    -- Include tickets requiring manager approval (conflict of interest OR high tips)
    AND st.approval_required_level = 'manager'
  GROUP BY st.id, e.display_name, completed_emp.display_name
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- ============================================================================
-- PART 3: BACKFILL EXISTING PENDING TICKETS
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
  v_required_level text;
  v_reason text;
  v_performed_and_closed boolean;
  v_total_tips numeric;
  v_updated_count int := 0;
BEGIN
  RAISE NOTICE 'Starting high-tip approval backfill for all pending tickets...';

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

    -- Get performers
    SELECT
      ARRAY_AGG(DISTINCT employee_id),
      COUNT(DISTINCT employee_id)
    INTO v_performers, v_performer_count
    FROM ticket_items
    WHERE sale_ticket_id = v_ticket.id;

    v_closer_is_performer := v_ticket.closed_by = ANY(v_performers);
    v_performed_and_closed := (v_performer_count = 1 AND v_closer_is_performer);

    -- Apply approval logic (HIGH TIP CHECK FIRST)
    IF v_total_tips > 20.00 THEN
      v_required_level := 'manager';
      v_reason := format('Ticket has tips totaling $%s (exceeds $20 limit) - requires Manager/Admin approval',
                        ROUND(v_total_tips, 2)::text);

    ELSIF v_closer_is_supervisor AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Supervisor performed service and closed ticket themselves - requires Manager/Admin approval';

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

    -- Update the ticket
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

  RAISE NOTICE 'Updated % pending approval tickets with high-tip check', v_updated_count;
END $$;

COMMENT ON FUNCTION set_approval_deadline IS
'Trigger function that sets approval routing when ticket is closed. Checks for high tips (>$20) and conflict of interest scenarios.';

COMMENT ON FUNCTION get_pending_approvals_for_management IS
'Returns pending approvals for management including conflict of interest cases AND tickets with tips exceeding $20';
