/*
  # Fix Supervisor Approval Routing Issue

  ## Problem Identified
  The `get_pending_approvals_for_supervisor` function incorrectly routes tickets.
  There are TWO different scenarios that both have `approval_required_level = 'supervisor'`:

  1. **Supervisor Self-Approval**: Supervisor performed service, Receptionist closed it
     → Only THAT specific supervisor should see and approve it

  2. **Receptionist Self-Performed**: Receptionist with service role performed AND closed
     → ANY supervisor can approve it (not filtered by performer)

  The current function filters by `ti.employee_id = p_employee_id`, which incorrectly
  shows Receptionist-self-performed tickets to all Supervisors.

  ## Solution
  Add a new column `approval_performer_id` to track WHO needs to approve supervisor-level tickets.
  - If NULL: ANY supervisor can approve (Receptionist self-performed case)
  - If set to UUID: Only that specific supervisor can approve (Supervisor self-approval case)

  ## Changes
  1. Add `approval_performer_id` column to sale_tickets
  2. Update trigger to set this field correctly
  3. Update `get_pending_approvals_for_supervisor` to use this field
  4. Backfill existing pending tickets
*/

-- ============================================================================
-- PART 1: ADD NEW COLUMN TO TRACK PERFORMER FOR SUPERVISOR APPROVALS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_tickets' AND column_name = 'approval_performer_id'
  ) THEN
    ALTER TABLE sale_tickets ADD COLUMN approval_performer_id uuid REFERENCES employees(id);
  END IF;
END $$;

COMMENT ON COLUMN sale_tickets.approval_performer_id IS
'For supervisor-level approvals, specifies which performer needs to approve.
NULL = any supervisor can approve (Receptionist self-performed case)
UUID = only that specific supervisor can approve (Supervisor self-approval case)';

-- ============================================================================
-- PART 2: UPDATE TRIGGER TO SET approval_performer_id CORRECTLY
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
  v_supervisor_performer_id uuid;
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

    -- Check if a Supervisor performed the service (and get their ID)
    SELECT ti.employee_id INTO v_supervisor_performer_id
    FROM ticket_items ti
    INNER JOIN employees e ON ti.employee_id = e.id
    WHERE ti.sale_ticket_id = NEW.id
    AND 'Supervisor' = ANY(e.role)
    LIMIT 1;

    /*
      APPROVAL ROUTING LOGIC
    */

    -- CASE 1: Supervisor performed AND closed themselves (conflict of interest)
    IF v_closer_is_supervisor AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Supervisor performed and closed ticket themselves - requires Manager/Owner/Admin approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL;

    -- CASE 2: Receptionist with service role performed AND closed themselves
    -- ANY supervisor can approve (not filtered by performer)
    ELSIF v_closer_is_receptionist AND v_performed_and_closed AND
          (v_closer_is_technician OR v_closer_is_spa_expert) THEN
      v_required_level := 'supervisor';
      v_reason := 'Receptionist with service role performed and closed ticket themselves - requires Supervisor approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL; -- ANY supervisor can approve

    -- CASE 3: Dual-role Technician+Receptionist performed AND closed themselves
    ELSIF v_closer_is_technician AND v_closer_is_receptionist AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Employee with both Technician and Receptionist roles performed and closed - requires Manager approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := NULL;

    -- CASE 4: Supervisor performed but someone else closed (typically Receptionist)
    -- ONLY that specific Supervisor can approve
    ELSIF v_closer_is_performer = false AND v_supervisor_performer_id IS NOT NULL THEN
      v_required_level := 'supervisor';
      v_reason := 'Supervisor performed service, closed by someone else - requires Supervisor approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := v_supervisor_performer_id; -- ONLY this supervisor can approve

    -- CASE 5: All other scenarios - standard technician peer approval
    ELSE
      v_required_level := 'technician';
      v_reason := 'Standard technician peer approval';
      NEW.requires_higher_approval := false;
      NEW.approval_performer_id := NULL;
    END IF;

    -- Set the approval metadata
    NEW.approval_required_level := v_required_level;
    NEW.approval_reason := v_reason;
    NEW.performed_and_closed_by_same_person := v_performed_and_closed;

  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 3: UPDATE SUPERVISOR APPROVAL FUNCTION WITH CORRECT FILTERING
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
  LEFT JOIN ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN services s ON ti.service_id = s.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    -- Only show tickets requiring supervisor-level approval
    AND st.approval_required_level = 'supervisor'
    -- Supervisor cannot approve tickets they closed themselves
    AND st.closed_by != p_employee_id
    -- CRITICAL FIX: Filter based on approval_performer_id
    -- If approval_performer_id is NULL: ANY supervisor can approve (Receptionist self-performed)
    -- If approval_performer_id is set: ONLY that specific supervisor can approve (Supervisor self-approval)
    AND (
      st.approval_performer_id IS NULL  -- ANY supervisor can approve
      OR st.approval_performer_id = p_employee_id  -- Or this specific supervisor
    )
  GROUP BY st.id, e.display_name, st.ticket_no, st.ticket_date, st.closed_at,
           st.approval_deadline, st.customer_name, st.customer_phone, st.total,
           st.payment_method, st.requires_higher_approval, st.approval_reason
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- ============================================================================
-- PART 4: BACKFILL approval_performer_id FOR EXISTING PENDING TICKETS
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
  v_supervisor_performed_id uuid;
  v_approval_performer_id uuid;
  v_updated_count int := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of approval_performer_id for all pending tickets...';

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

    -- Check if a Supervisor performed the service (and get their ID)
    SELECT ti.employee_id INTO v_supervisor_performed_id
    FROM ticket_items ti
    INNER JOIN employees e ON ti.employee_id = e.id
    WHERE ti.sale_ticket_id = v_ticket.id
    AND 'Supervisor' = ANY(e.role)
    LIMIT 1;

    -- Determine approval_performer_id based on scenario
    v_approval_performer_id := NULL; -- Default: any supervisor/technician can approve

    -- Apply approval logic (matching the trigger logic)
    IF v_closer_is_supervisor AND v_performed_and_closed THEN
      -- Supervisor performed AND closed themselves - goes to management
      v_required_level := 'manager';
      v_reason := 'Supervisor performed and closed ticket themselves - requires Manager/Owner/Admin approval';
      v_approval_performer_id := NULL;

    ELSIF v_closer_is_receptionist AND v_performed_and_closed AND
          (v_closer_is_technician OR v_closer_is_spa_expert) THEN
      -- Receptionist with service role performed AND closed - ANY supervisor can approve
      v_required_level := 'supervisor';
      v_reason := 'Receptionist with service role performed and closed ticket themselves - requires Supervisor approval';
      v_approval_performer_id := NULL; -- ANY supervisor

    ELSIF v_closer_is_technician AND v_closer_is_receptionist AND v_performed_and_closed THEN
      -- Dual-role performed AND closed - goes to management
      v_required_level := 'manager';
      v_reason := 'Employee with both Technician and Receptionist roles performed and closed - requires Manager approval';
      v_approval_performer_id := NULL;

    ELSIF v_closer_is_performer = false AND v_supervisor_performed_id IS NOT NULL THEN
      -- Supervisor performed but someone else closed - ONLY that supervisor can approve
      v_required_level := 'supervisor';
      v_reason := 'Supervisor performed service, closed by someone else - requires Supervisor approval';
      v_approval_performer_id := v_supervisor_performed_id; -- ONLY this supervisor

    ELSE
      -- All other scenarios - technician approval
      v_required_level := 'technician';
      v_reason := 'Standard technician peer approval';
      v_approval_performer_id := NULL;
    END IF;

    -- Update the ticket
    UPDATE sale_tickets
    SET
      approval_required_level = v_required_level,
      approval_reason = v_reason,
      performed_and_closed_by_same_person = v_performed_and_closed,
      requires_higher_approval = (v_required_level != 'technician'),
      approval_performer_id = v_approval_performer_id
    WHERE id = v_ticket.id
      AND (
        approval_required_level IS DISTINCT FROM v_required_level
        OR approval_reason IS DISTINCT FROM v_reason
        OR performed_and_closed_by_same_person IS DISTINCT FROM v_performed_and_closed
        OR approval_performer_id IS DISTINCT FROM v_approval_performer_id
      );

    IF FOUND THEN
      v_updated_count := v_updated_count + 1;
    END IF;

  END LOOP;

  RAISE NOTICE 'Successfully backfilled approval_performer_id for % pending tickets', v_updated_count;
END $$;

-- ============================================================================
-- PART 5: ADD INDEX FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sale_tickets_approval_performer
  ON sale_tickets(approval_performer_id)
  WHERE approval_status = 'pending_approval';

-- Update comments
COMMENT ON FUNCTION get_pending_approvals_for_supervisor IS
'Returns supervisor-level approval tickets filtered correctly:
- Receptionist self-performed tickets (approval_performer_id IS NULL): visible to ANY supervisor
- Supervisor self-approval tickets (approval_performer_id = specific UUID): visible ONLY to that supervisor';
