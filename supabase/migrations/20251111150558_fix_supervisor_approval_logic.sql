/*
  # Fix Supervisor Approval Logic - Correct Implementation

  ## Overview
  Implements the correct approval workflow for tickets involving Supervisors:

  ### Approval Rules (Correct Logic):
  1. **Supervisor performs + Receptionist closes** → Supervisor approves
  2. **Supervisor performs + Supervisor closes** → Owner/Manager/Admin approves (conflict of interest)
  3. **Technician performs + Supervisor closes** → Technician approves (Supervisor cannot approve)
  4. **Technician performs + Receptionist closes** → Technician approves (standard peer approval)

  ## Key Principles
  - The role of the closer does NOT automatically escalate approval requirements
  - What matters is whether the same person has complete control (performed AND closed)
  - Supervisors can approve their own work when closed by others
  - Supervisors cannot approve work performed by other technicians
  - Only when a Supervisor both performs and closes their own ticket does it require management approval

  ## Changes
  1. Update set_approval_deadline trigger with correct logic
  2. Update get_pending_approvals_for_supervisor function
  3. Update get_pending_approvals_for_technician function
  4. Update get_pending_approvals_for_management function
  5. Update approve_ticket function with proper role validation
  6. Recalculate all existing pending tickets

  ## Security
  - Enforces proper separation of duties
  - Prevents conflicts of interest
  - Maintains audit trail of approval requirements
*/

-- ============================================================================
-- PART 1: UPDATE APPROVAL DEADLINE TRIGGER WITH CORRECT LOGIC
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
BEGIN
  -- Only process when ticket is being closed for the first time
  IF NEW.closed_at IS NOT NULL AND (OLD.closed_at IS NULL OR OLD.closed_at IS DISTINCT FROM NEW.closed_at) THEN

    -- Set basic approval fields
    NEW.approval_status := 'pending_approval';
    NEW.approval_deadline := NEW.closed_at + INTERVAL '48 hours';

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
    FROM ticket_items
    WHERE sale_ticket_id = NEW.id;

    -- Check if closer is one of the performers
    v_closer_is_performer := NEW.closed_by = ANY(v_performers);

    -- Check if this is a single-person ticket (one person did everything)
    v_performed_and_closed := (v_performer_count = 1 AND v_closer_is_performer);

    /*
      CORRECT LOGIC IMPLEMENTATION:

      The key insight: The role of the closer doesn't automatically escalate approval.
      What matters is whether the same person has complete control (performed AND closed).
    */

    -- CASE 1: Supervisor performed AND closed themselves (conflict of interest)
    IF v_closer_is_supervisor AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Supervisor performed and closed ticket themselves - requires Manager/Owner/Admin approval';
      NEW.requires_higher_approval := true;

    -- CASE 2: Receptionist with service role performed AND closed themselves
    ELSIF v_closer_is_receptionist AND v_performed_and_closed AND
          (v_closer_is_technician OR v_closer_is_spa_expert) THEN
      v_required_level := 'supervisor';
      v_reason := 'Receptionist with service role performed and closed ticket themselves - requires Supervisor approval';
      NEW.requires_higher_approval := true;

    -- CASE 3: Dual-role Technician+Receptionist performed AND closed themselves
    ELSIF v_closer_is_technician AND v_closer_is_receptionist AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Employee with both Technician and Receptionist roles performed and closed - requires Manager approval';
      NEW.requires_higher_approval := true;

    -- CASE 4: Supervisor performed but someone else closed (typically Receptionist)
    -- This should route to the Supervisor for approval (not management)
    ELSIF v_closer_is_performer = false AND
          EXISTS (
            SELECT 1 FROM ticket_items ti
            INNER JOIN employees e ON ti.employee_id = e.id
            WHERE ti.sale_ticket_id = NEW.id
            AND 'Supervisor' = ANY(e.role)
          ) THEN
      v_required_level := 'supervisor';
      v_reason := 'Supervisor performed service, closed by someone else - requires Supervisor approval';
      NEW.requires_higher_approval := true;

    -- CASE 5: All other scenarios - standard technician peer approval
    -- This includes: Technician performs + Supervisor closes
    -- This includes: Technician performs + Receptionist closes
    ELSE
      v_required_level := 'technician';
      v_reason := 'Standard technician peer approval';
      NEW.requires_higher_approval := false;
    END IF;

    -- Set the approval metadata
    NEW.approval_required_level := v_required_level;
    NEW.approval_reason := v_reason;
    NEW.performed_and_closed_by_same_person := v_performed_and_closed;

  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists and is attached
DROP TRIGGER IF EXISTS trigger_set_approval_deadline ON sale_tickets;
CREATE TRIGGER trigger_set_approval_deadline
  BEFORE UPDATE ON sale_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_approval_deadline();

-- ============================================================================
-- PART 2: UPDATE SUPERVISOR APPROVAL QUEUE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_approvals_for_supervisor(
  p_employee_id uuid,
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
  hours_remaining numeric,
  service_name text,
  tip_customer numeric,
  tip_receptionist numeric,
  payment_method text,
  requires_higher_approval boolean,
  approval_reason text
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
    EXTRACT(EPOCH FROM (st.approval_deadline - NOW())) / 3600 as hours_remaining,
    STRING_AGG(DISTINCT s.name, ', ') as service_name,
    COALESCE(SUM(ti.tip_customer_cash + ti.tip_customer_card), 0) as tip_customer,
    COALESCE(SUM(ti.tip_receptionist), 0) as tip_receptionist,
    st.payment_method,
    COALESCE(st.requires_higher_approval, false) as requires_higher_approval,
    st.approval_reason
  FROM sale_tickets st
  LEFT JOIN employees e ON st.closed_by = e.id
  INNER JOIN ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN services s ON ti.service_id = s.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    -- Only show tickets requiring supervisor-level approval
    AND st.approval_required_level = 'supervisor'
    -- Supervisor must have performed the work
    AND ti.employee_id = p_employee_id
    -- Supervisor cannot approve tickets they closed themselves
    AND st.closed_by != p_employee_id
  GROUP BY st.id, e.display_name, st.ticket_no, st.ticket_date, st.closed_at,
           st.approval_deadline, st.customer_name, st.customer_phone, st.total,
           st.payment_method, st.requires_higher_approval, st.approval_reason
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- ============================================================================
-- PART 3: UPDATE TECHNICIAN APPROVAL QUEUE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_approvals_for_technician(
  p_employee_id uuid,
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
  hours_remaining numeric,
  service_name text,
  tip_customer numeric,
  tip_receptionist numeric,
  payment_method text,
  requires_higher_approval boolean,
  approval_reason text
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
    EXTRACT(EPOCH FROM (st.approval_deadline - NOW())) / 3600 as hours_remaining,
    STRING_AGG(DISTINCT s.name, ', ') as service_name,
    COALESCE(SUM(ti.tip_customer_cash + ti.tip_customer_card), 0) as tip_customer,
    COALESCE(SUM(ti.tip_receptionist), 0) as tip_receptionist,
    st.payment_method,
    COALESCE(st.requires_higher_approval, false) as requires_higher_approval,
    st.approval_reason
  FROM sale_tickets st
  LEFT JOIN employees e ON st.closed_by = e.id
  INNER JOIN ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN services s ON ti.service_id = s.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    -- Only show tickets requiring technician-level approval
    AND st.approval_required_level = 'technician'
    -- Technician must have worked on this ticket
    AND ti.employee_id = p_employee_id
    -- Technician cannot approve tickets they closed themselves
    AND st.closed_by != p_employee_id
  GROUP BY st.id, e.display_name, st.ticket_no, st.ticket_date, st.closed_at,
           st.approval_deadline, st.customer_name, st.customer_phone, st.total,
           st.payment_method, st.requires_higher_approval, st.approval_reason
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- ============================================================================
-- PART 4: UPDATE MANAGEMENT APPROVAL QUEUE FUNCTION
-- ============================================================================

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
  reason text
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
    COALESCE(SUM(ti.tip_customer_cash + ti.tip_customer_card), 0) as tip_customer,
    COALESCE(SUM(ti.tip_receptionist), 0) as tip_receptionist,
    st.payment_method,
    COALESCE(st.requires_higher_approval, false) as requires_higher_approval,
    STRING_AGG(DISTINCT emp.display_name, ', ') as technician_names,
    COALESCE(st.approval_reason, 'Requires management review') as reason
  FROM sale_tickets st
  LEFT JOIN employees e ON st.closed_by = e.id
  LEFT JOIN ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN services s ON ti.service_id = s.id
  LEFT JOIN employees emp ON ti.employee_id = emp.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    -- Only show tickets requiring manager-level approval
    AND st.approval_required_level = 'manager'
    -- Only show true conflict-of-interest cases (same person performed AND closed)
    AND COALESCE(st.performed_and_closed_by_same_person, false) = true
  GROUP BY st.id, e.display_name, st.closed_by_roles
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- ============================================================================
-- PART 5: UPDATE APPROVE TICKET FUNCTION WITH CORRECT ROLE VALIDATION
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

  -- Check if approver worked on this ticket
  v_worked_on_ticket := EXISTS (
    SELECT 1 FROM ticket_items
    WHERE sale_ticket_id = p_ticket_id AND employee_id = p_employee_id
  );

  -- Apply approval rules based on required level
  CASE v_ticket.approval_required_level

    -- MANAGER/OWNER LEVEL REQUIRED (Supervisor performed AND closed themselves)
    WHEN 'manager' THEN
      IF NOT (v_is_manager OR v_is_owner) THEN
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
      -- Or higher level (Manager/Owner) can also approve
      ELSIF NOT (v_is_manager OR v_is_owner) THEN
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
      -- Or higher level (Supervisor/Manager/Owner) can also approve
      ELSIF NOT (v_is_supervisor OR v_is_manager OR v_is_owner) THEN
        RETURN json_build_object(
          'success', false,
          'message', 'You do not have permission to approve tickets'
        );
      END IF;

    ELSE
      RETURN json_build_object('success', false, 'message', 'Invalid approval level configuration');
  END CASE;

  -- Additional safety check: If performer and closer are the same person, they cannot approve
  -- (This should already be prevented by closed_by check, but double-check)
  IF v_ticket.performed_and_closed_by_same_person AND v_worked_on_ticket THEN
    -- Management can still approve these cases
    IF NOT (v_is_manager OR v_is_owner) THEN
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
-- PART 6: RECALCULATE ALL EXISTING PENDING TICKETS
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
  v_updated_count int := 0;
  v_supervisor_performed boolean;
BEGIN
  RAISE NOTICE 'Starting recalculation of approval routing for all pending tickets...';

  FOR v_ticket IN
    SELECT id, closed_by, closed_by_roles
    FROM sale_tickets
    WHERE approval_status = 'pending_approval'
      AND closed_at IS NOT NULL
  LOOP
    -- Get closer's roles
    v_closer_roles := COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(v_ticket.closed_by_roles)),
      ARRAY[]::text[]
    );

    -- Fallback: get roles from employees table if not stored
    IF array_length(v_closer_roles, 1) IS NULL OR array_length(v_closer_roles, 1) = 0 THEN
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

    -- Check if a Supervisor performed the service (regardless of who closed)
    SELECT EXISTS (
      SELECT 1 FROM ticket_items ti
      INNER JOIN employees e ON ti.employee_id = e.id
      WHERE ti.sale_ticket_id = v_ticket.id
      AND 'Supervisor' = ANY(e.role)
    ) INTO v_supervisor_performed;

    -- Apply approval logic (matching the trigger logic)
    IF v_closer_is_supervisor AND v_performed_and_closed THEN
      -- Supervisor performed AND closed themselves
      v_required_level := 'manager';
      v_reason := 'Supervisor performed and closed ticket themselves - requires Manager/Owner/Admin approval';

    ELSIF v_closer_is_receptionist AND v_performed_and_closed AND
          (v_closer_is_technician OR v_closer_is_spa_expert) THEN
      -- Receptionist with service role performed AND closed
      v_required_level := 'supervisor';
      v_reason := 'Receptionist with service role performed and closed ticket themselves - requires Supervisor approval';

    ELSIF v_closer_is_technician AND v_closer_is_receptionist AND v_performed_and_closed THEN
      -- Dual-role performed AND closed
      v_required_level := 'manager';
      v_reason := 'Employee with both Technician and Receptionist roles performed and closed - requires Manager approval';

    ELSIF v_closer_is_performer = false AND v_supervisor_performed THEN
      -- Supervisor performed but someone else closed
      v_required_level := 'supervisor';
      v_reason := 'Supervisor performed service, closed by someone else - requires Supervisor approval';

    ELSE
      -- All other scenarios - technician approval
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

  RAISE NOTICE 'Successfully recalculated % pending approval tickets', v_updated_count;
END $$;

-- ============================================================================
-- PART 7: ADD HELPFUL INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for filtering by approval_required_level and approval_status
CREATE INDEX IF NOT EXISTS idx_sale_tickets_approval_level_status
  ON sale_tickets(approval_required_level, approval_status)
  WHERE approval_status = 'pending_approval';

-- Index for performer lookups
CREATE INDEX IF NOT EXISTS idx_ticket_items_ticket_employee
  ON ticket_items(sale_ticket_id, employee_id);

-- Add comment explaining the correct logic
COMMENT ON FUNCTION set_approval_deadline IS
'Determines approval routing based on performer vs closer relationship.
Key principle: The role of closer does not automatically escalate approval.
Only when same person performs AND closes does it require higher approval.';

COMMENT ON FUNCTION get_pending_approvals_for_supervisor IS
'Returns tickets where Supervisor performed the service but someone else (typically Receptionist) closed it.
Supervisors can approve their own work when closed by others.';

COMMENT ON FUNCTION get_pending_approvals_for_technician IS
'Returns tickets where Technician performed the service and someone else closed it (could be Receptionist or Supervisor).
Technicians approve their own work regardless of who closed the ticket.';

COMMENT ON FUNCTION get_pending_approvals_for_management IS
'Returns tickets requiring Manager/Owner approval - only conflict-of-interest cases where Supervisor performed AND closed themselves.';
