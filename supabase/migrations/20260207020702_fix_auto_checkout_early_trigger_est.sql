-- Fix: auto_checkout_employees_by_context() fires 1 hour early during EST (winter)
--
-- Two pg_cron jobs exist:
--   auto-checkout-2200-edt  at  0 2 * * *  (2:00 UTC = 10 PM EDT / 9 PM EST)
--   auto-checkout-2200-est  at  0 3 * * *  (3:00 UTC = 10 PM EST / 11 PM EDT)
--
-- The migration comment claimed the "wrong season" job would be a no-op, but the
-- function had no guard — it processes ALL checked-in employees regardless of the
-- actual Eastern time.  During winter (EST), the EDT job fires at 9 PM EST and
-- checks everyone out an hour early.
--
-- Fix: add a time guard after v_eastern_time is computed.  If it's before 22:00
-- Eastern, the function returns immediately, making the wrong-season job a true
-- no-op.

CREATE OR REPLACE FUNCTION public.auto_checkout_employees_by_context()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_last_ticket_time timestamptz;
  v_store_closing_time timestamptz;
  v_checkout_time timestamptz;
  v_hours numeric;
  v_eastern_time timestamptz;
  v_eastern_date date;
  v_day_of_week text;
  v_closing_time_str text;
  v_checkout_source text;
  v_use_last_ticket boolean;
BEGIN
  v_eastern_time := now() AT TIME ZONE 'America/New_York';

  -- Only proceed if it's 10 PM (22:00) or later in Eastern time.
  -- This makes the "wrong season" cron job a true no-op.
  IF v_eastern_time::time < '22:00'::time THEN
    RETURN;
  END IF;

  v_eastern_date := v_eastern_time::date;
  v_day_of_week := lower(trim(to_char(v_eastern_time, 'day')));

  FOR v_record IN
    SELECT ar.id as attendance_id, ar.employee_id, ar.store_id, ar.check_in_time, ar.work_date, ar.notes,
           s.closing_hours, e.role as employee_role, e.pay_type as employee_pay_type
    FROM public.attendance_records ar
    JOIN public.stores s ON ar.store_id = s.id
    JOIN public.employees e ON ar.employee_id = e.id
    WHERE ar.status = 'checked_in' AND ar.work_date = v_eastern_date
  LOOP
    SELECT MAX(st.closed_at) INTO v_last_ticket_time
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = v_record.employee_id AND st.store_id = v_record.store_id
      AND st.ticket_date = v_record.work_date AND st.closed_at IS NOT NULL;

    v_store_closing_time := NULL;
    IF v_record.closing_hours IS NOT NULL THEN
      v_closing_time_str := v_record.closing_hours->>v_day_of_week;
      IF v_closing_time_str IS NOT NULL THEN
        v_store_closing_time := ((v_record.work_date || ' ' || v_closing_time_str)::timestamp AT TIME ZONE 'America/New_York');
      END IF;
    END IF;

    v_use_last_ticket := (v_record.employee_pay_type = 'commission' OR
      (v_record.employee_pay_type = 'daily' AND (v_record.employee_role @> ARRAY['Technician']::text[] OR
       v_record.employee_role @> ARRAY['Supervisor']::text[] OR v_record.employee_role @> ARRAY['Manager']::text[])));

    IF v_use_last_ticket THEN
      IF v_last_ticket_time IS NOT NULL THEN v_checkout_time := v_last_ticket_time; v_checkout_source := 'last_ticket';
      ELSIF v_store_closing_time IS NOT NULL THEN v_checkout_time := v_store_closing_time; v_checkout_source := 'no_ticket_store_close';
      ELSE v_checkout_time := now(); v_checkout_source := 'fallback_now'; END IF;
    ELSIF v_record.employee_pay_type = 'daily' AND v_record.employee_role @> ARRAY['Receptionist']::text[] THEN
      IF v_store_closing_time IS NOT NULL THEN v_checkout_time := v_store_closing_time; v_checkout_source := 'store_close';
      ELSE v_checkout_time := now(); v_checkout_source := 'fallback_now'; END IF;
    ELSE
      IF v_last_ticket_time IS NOT NULL AND v_store_closing_time IS NOT NULL THEN
        IF v_last_ticket_time > v_store_closing_time THEN v_checkout_time := v_last_ticket_time; v_checkout_source := 'late_ticket';
        ELSE v_checkout_time := v_store_closing_time; v_checkout_source := 'store_hours'; END IF;
      ELSIF v_last_ticket_time IS NOT NULL THEN v_checkout_time := v_last_ticket_time; v_checkout_source := 'ticket_only';
      ELSIF v_store_closing_time IS NOT NULL THEN v_checkout_time := v_store_closing_time; v_checkout_source := 'store_hours_only';
      ELSE v_checkout_time := now(); v_checkout_source := 'fallback_now'; END IF;
    END IF;

    v_hours := EXTRACT(EPOCH FROM (v_checkout_time - v_record.check_in_time)) / 3600;
    IF v_hours < 0 THEN CONTINUE; END IF;

    UPDATE public.attendance_records
    SET check_out_time = v_checkout_time, total_hours = v_hours, status = 'auto_checked_out',
        notes = COALESCE(notes, '') || ' [Auto: ' || v_checkout_source || ']', updated_at = now()
    WHERE id = v_record.attendance_id;

    -- Also remove employee from the ready queue on auto-checkout
    DELETE FROM public.technician_ready_queue
    WHERE employee_id = v_record.employee_id
      AND store_id = v_record.store_id;
  END LOOP;
END;
$$;
