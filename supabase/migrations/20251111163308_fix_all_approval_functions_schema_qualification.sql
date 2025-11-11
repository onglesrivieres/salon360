/*
  # Fix All Approval Functions Schema Qualification

  1. Overview
     - Adds explicit schema qualifications (public.) to all table references
     - Fixes the "relation does not exist" errors
     - Makes functions compatible with empty search_path security setting

  2. Functions Fixed
     - set_approval_deadline() trigger function
     - get_pending_approvals_for_technician()
     - get_pending_approvals_for_supervisor()
     - get_pending_approvals_for_management()

  3. Security
     - Maintains security by working with empty search_path
     - Prevents search_path manipulation attacks
*/

-- ============================================================================
-- FIX TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_approval_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
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

    ELSIF v_closer_is_performer = false AND v_supervisor_performer_id IS NOT NULL THEN
      v_required_level := 'supervisor';
      v_reason := 'Supervisor performed service, closed by someone else - requires Supervisor approval';
      NEW.requires_higher_approval := true;
      NEW.approval_performer_id := v_supervisor_performer_id;

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

-- Set search_path to empty for security
ALTER FUNCTION public.set_approval_deadline() SET search_path = '';

-- ============================================================================
-- FIX TECHNICIAN APPROVAL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_approvals_for_technician(
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
  FROM public.sale_tickets st
  INNER JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.services s ON ti.service_id = s.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    AND st.approval_required_level = 'technician'
    AND ti.employee_id = p_employee_id
    AND st.closed_by != p_employee_id
  GROUP BY st.id, e.display_name, st.ticket_no, st.ticket_date, st.closed_at,
           st.approval_deadline, st.customer_name, st.customer_phone, st.total,
           st.payment_method, st.requires_higher_approval, st.approval_reason
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.get_pending_approvals_for_technician(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- ============================================================================
-- FIX SUPERVISOR APPROVAL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_approvals_for_supervisor(
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
  FROM public.sale_tickets st
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.services s ON ti.service_id = s.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    AND st.approval_required_level = 'supervisor'
    AND st.closed_by != p_employee_id
    AND (
      st.approval_performer_id IS NULL
      OR st.approval_performer_id = p_employee_id
    )
  GROUP BY st.id, e.display_name, st.ticket_no, st.ticket_date, st.closed_at,
           st.approval_deadline, st.customer_name, st.customer_phone, st.total,
           st.payment_method, st.requires_higher_approval, st.approval_reason
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.get_pending_approvals_for_supervisor(p_employee_id uuid, p_store_id uuid) SET search_path = '';

-- ============================================================================
-- FIX MANAGEMENT APPROVAL FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pending_approvals_for_management(
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
  FROM public.sale_tickets st
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.services s ON ti.service_id = s.id
  LEFT JOIN public.employees emp ON ti.employee_id = emp.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    AND st.approval_required_level = 'manager'
  GROUP BY st.id, e.display_name, st.ticket_no, st.ticket_date, st.closed_at,
           st.approval_deadline, st.customer_name, st.customer_phone, st.total,
           st.closed_by_roles, st.payment_method, st.requires_higher_approval, st.approval_reason
  ORDER BY st.approval_deadline ASC;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.get_pending_approvals_for_management(p_store_id uuid) SET search_path = '';

-- Add comments
COMMENT ON FUNCTION public.get_pending_approvals_for_technician IS 'Returns technician-level approval tickets. All tables fully qualified for security.';
COMMENT ON FUNCTION public.get_pending_approvals_for_supervisor IS 'Returns supervisor-level approval tickets. All tables fully qualified for security.';
COMMENT ON FUNCTION public.get_pending_approvals_for_management IS 'Returns management-level approval tickets. All tables fully qualified for security.';
