/*
  # Squashed Migration: Ticket Approval System

  ## Overview
  This migration consolidates ticket approval migrations for multi-level
  approval routing with auto-approval support.

  ## Functions Created
  - set_approval_deadline: Trigger to set approval routing
  - approve_ticket: Approve with role validation
  - reject_ticket: Reject with admin review flag
  - get_pending_approvals_for_*: Role-based approval queries
  - auto_approve_expired_tickets: Cron-based auto-approval

  ## Key Features
  - Multi-level approval routing (technician, supervisor, manager, owner)
  - High-tip detection ($20+ threshold)
  - Self-service conflict detection
  - Configurable auto-approval deadlines
*/

-- ============================================================================
-- TABLE: ticket_reopen_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ticket_reopen_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.sale_tickets(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reason_comment text NOT NULL,
  requested_changes_description text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewed_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_reopen_requests_ticket ON public.ticket_reopen_requests(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_reopen_requests_store ON public.ticket_reopen_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_ticket_reopen_requests_status ON public.ticket_reopen_requests(status);

ALTER TABLE public.ticket_reopen_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to ticket_reopen_requests" ON public.ticket_reopen_requests;
CREATE POLICY "Allow all access to ticket_reopen_requests"
  ON public.ticket_reopen_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- FUNCTION: set_approval_deadline (Trigger)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_approval_deadline()
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
  v_closer_is_manager boolean;
  v_required_level text;
  v_reason text;
  v_performed_and_closed boolean;
  v_total_tips numeric;
BEGIN
  IF NEW.closed_at IS NOT NULL AND (OLD.closed_at IS NULL OR OLD.closed_at IS DISTINCT FROM NEW.closed_at) THEN
    NEW.approval_status := 'pending_approval';
    NEW.approval_deadline := NEW.closed_at + INTERVAL '48 hours';

    -- Calculate total tips
    SELECT COALESCE(SUM(COALESCE(tip_customer_cash, 0) + COALESCE(tip_customer_card, 0) + COALESCE(tip_receptionist, 0)), 0)
    INTO v_total_tips FROM public.ticket_items WHERE sale_ticket_id = NEW.id;

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
    ELSIF v_closer_is_receptionist AND v_performed_and_closed AND (v_closer_is_technician OR v_closer_is_spa_expert) THEN
      v_required_level := 'supervisor'; v_reason := 'Receptionist performed and closed ticket'; NEW.requires_higher_approval := true;
    ELSIF v_closer_is_technician AND v_closer_is_receptionist AND v_performed_and_closed THEN
      v_required_level := 'manager'; v_reason := 'Dual-role employee performed and closed'; NEW.requires_higher_approval := true;
    ELSE
      v_required_level := 'technician'; v_reason := 'Standard technician peer approval'; NEW.requires_higher_approval := false;
    END IF;

    NEW.approval_required_level := v_required_level;
    NEW.approval_reason := v_reason;
    NEW.performed_and_closed_by_same_person := v_performed_and_closed;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_approval_deadline ON public.sale_tickets;
CREATE TRIGGER trigger_set_approval_deadline
  BEFORE UPDATE ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.set_approval_deadline();

-- ============================================================================
-- FUNCTION: approve_ticket
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_ticket(p_ticket_id uuid, p_employee_id uuid)
RETURNS json
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket public.sale_tickets; v_approver_roles text[];
  v_is_technician boolean; v_is_spa_expert boolean; v_is_supervisor boolean;
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
      IF v_is_supervisor THEN
        IF NOT v_worked_on_ticket THEN RETURN json_build_object('success', false, 'message', 'Supervisors must have performed service'); END IF;
      ELSIF NOT (v_is_manager OR v_is_owner OR v_is_admin) THEN
        RETURN json_build_object('success', false, 'message', format('Requires Supervisor+ approval: %s', v_ticket.approval_reason));
      END IF;
    WHEN 'technician' THEN
      IF v_is_technician OR v_is_spa_expert THEN
        IF NOT v_worked_on_ticket THEN RETURN json_build_object('success', false, 'message', 'Must have worked on ticket to approve'); END IF;
      ELSIF NOT (v_is_supervisor OR v_is_manager OR v_is_owner OR v_is_admin) THEN
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

-- ============================================================================
-- FUNCTION: reject_ticket
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_ticket(p_ticket_id uuid, p_employee_id uuid, p_rejection_reason text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_ticket public.sale_tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_ticket FROM public.sale_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Ticket not found'); END IF;
  IF v_ticket.approval_status != 'pending_approval' THEN RETURN json_build_object('success', false, 'message', 'Not pending approval'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ticket_items WHERE sale_ticket_id = p_ticket_id AND employee_id = p_employee_id) THEN
    RETURN json_build_object('success', false, 'message', 'Not assigned to this ticket');
  END IF;

  UPDATE public.sale_tickets SET approval_status = 'rejected', rejection_reason = p_rejection_reason,
         requires_admin_review = true, updated_at = now() WHERE id = p_ticket_id;

  RETURN json_build_object('success', true, 'message', 'Ticket rejected for admin review');
END;
$$;

-- ============================================================================
-- FUNCTION: get_pending_approvals_for_technician
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_approvals_for_technician(p_employee_id uuid, p_store_id uuid)
RETURNS TABLE (
  ticket_id uuid, ticket_no text, ticket_date date, closed_at timestamptz, approval_deadline timestamptz,
  customer_name text, customer_phone text, total numeric, closed_by_name text, hours_remaining numeric,
  service_name text, tip_customer numeric, tip_receptionist numeric, payment_method text,
  requires_higher_approval boolean, approval_reason text
)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT st.id, st.ticket_no, st.ticket_date, st.closed_at, st.approval_deadline, st.customer_name, st.customer_phone, st.total,
         COALESCE(e.display_name, 'Unknown'), EXTRACT(EPOCH FROM (st.approval_deadline - NOW())) / 3600,
         STRING_AGG(DISTINCT s.name, ', '), COALESCE(SUM(ti.tip_customer_cash + ti.tip_customer_card), 0),
         COALESCE(SUM(ti.tip_receptionist), 0), st.payment_method, COALESCE(st.requires_higher_approval, false), st.approval_reason
  FROM public.sale_tickets st
  INNER JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.services s ON ti.service_id = s.id
  WHERE st.store_id = p_store_id AND st.approval_status = 'pending_approval' AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW() AND st.approval_required_level = 'technician'
    AND ti.employee_id = p_employee_id AND st.closed_by != p_employee_id
  GROUP BY st.id, e.display_name ORDER BY st.approval_deadline ASC;
END;
$$;

-- ============================================================================
-- FUNCTION: get_pending_approvals_for_management
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_approvals_for_management(p_store_id uuid)
RETURNS TABLE (
  ticket_id uuid, ticket_no text, ticket_date date, closed_at timestamptz, approval_deadline timestamptz,
  customer_name text, customer_phone text, total numeric, closed_by_name text, closed_by_roles jsonb,
  hours_remaining numeric, service_name text, tip_customer numeric, tip_receptionist numeric,
  payment_method text, requires_higher_approval boolean, technician_names text, reason text, completed_by_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT st.id, st.ticket_no, st.ticket_date, st.closed_at, st.approval_deadline, st.customer_name, st.customer_phone, st.total,
         COALESCE(e.display_name, 'Unknown'), st.closed_by_roles, EXTRACT(EPOCH FROM (st.approval_deadline - NOW())) / 3600,
         STRING_AGG(DISTINCT s.name, ', '), SUM(ti.tip_customer_cash + ti.tip_customer_card), SUM(ti.tip_receptionist),
         st.payment_method, COALESCE(st.requires_higher_approval, false), STRING_AGG(DISTINCT emp.display_name, ', '),
         COALESCE(st.approval_reason, 'Requires management review'), COALESCE(completed_emp.display_name, 'N/A')
  FROM public.sale_tickets st
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.employees completed_emp ON st.completed_by = completed_emp.id
  LEFT JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.store_services s ON ti.store_service_id = s.id
  LEFT JOIN public.employees emp ON ti.employee_id = emp.id
  WHERE st.store_id = p_store_id AND st.approval_status = 'pending_approval' AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW() AND st.approval_required_level IN ('manager', 'owner')
  GROUP BY st.id, e.display_name, completed_emp.display_name ORDER BY st.approval_deadline ASC;
END;
$$;

-- ============================================================================
-- FUNCTION: auto_approve_expired_tickets
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_approve_expired_tickets()
RETURNS json
LANGUAGE plpgsql AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.sale_tickets SET approval_status = 'auto_approved', approved_at = now(), updated_at = now()
  WHERE approval_status = 'pending_approval' AND approval_deadline < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN json_build_object('success', true, 'message', format('Auto-approved %s ticket(s)', v_count), 'count', v_count);
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
