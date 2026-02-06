/*
  # Fix set_approval_deadline() — remove non-existent store_settings reference

  Migration 20260206000004 references `public.store_settings` table which does not exist.
  The original function in squash_08 used a hardcoded interval.

  Error: relation "public.store_settings" does not exist (PostgreSQL 42P01)

  ## Change
  - Removed `v_deadline_hours` variable and `store_settings` query
  - Hardcoded `INTERVAL '24 hours'` for approval deadline (matching intended default)
*/

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
  v_closer_is_manager boolean;
  v_performers uuid[];
  v_performer_count int;
  v_closer_is_performer boolean;
  v_performed_and_closed boolean;
  v_required_level text;
  v_reason text;
BEGIN
  -- Only run when ticket transitions to closed
  IF NEW.closed_at IS NOT NULL AND OLD.closed_at IS NULL THEN

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

    NEW.approval_status := 'pending_approval';
    NEW.approval_deadline := NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
