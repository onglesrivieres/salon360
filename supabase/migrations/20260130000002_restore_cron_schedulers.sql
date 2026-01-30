/*
  # Restore Cron Schedulers & Queue Cleanup

  ## Overview
  Re-creates pg_cron scheduled jobs and the auto_release_queue_at_closing() function
  that were lost during the migration squash on 2026-01-23. Also patches
  auto_checkout_employees_by_context() to remove employees from the queue on
  auto-checkout.

  ## Changes

  ### Extensions
  - `pg_cron` - Enabled for scheduled job execution

  ### Functions
  - `auto_release_queue_at_closing` - Store-aware queue cleanup at closing time
  - `auto_checkout_employees_by_context` - Updated to also clear queue entries

  ### Cron Jobs
  - `auto-release-queue-closing` - Every 15 min, clears queue for closed stores
  - `auto-checkout-2200-edt` - 02:00 UTC (22:00 EDT) auto-checkout
  - `auto-checkout-2200-est` - 03:00 UTC (22:00 EST) auto-checkout
  - `auto-approve-tickets` - Every 15 min, auto-approve expired tickets
  - `expire-violation-reports` - Every 5 min, expire stale violation reports

  ## Notes
  - Dual EDT/EST auto-checkout jobs handle daylight saving transitions
  - auto_release_queue_at_closing reads closing_hours from stores dynamically
  - All statements are idempotent (CREATE OR REPLACE, cron.unschedule before schedule)
*/

-- ============================================================================
-- EXTENSION: pg_cron
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- FUNCTION: auto_release_queue_at_closing (store-aware version)
-- ============================================================================
-- Replaces the old hardcoded version with one that reads closing_hours from
-- each store dynamically. Runs every 15 minutes and clears queue entries for
-- any store whose closing time has passed.
CREATE OR REPLACE FUNCTION public.auto_release_queue_at_closing()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eastern_time timestamptz;
  v_eastern_time_only time;
  v_day_of_week text;
  v_store RECORD;
  v_closing_time_str text;
  v_closing_time time;
BEGIN
  -- Get current time in Eastern timezone
  v_eastern_time := now() AT TIME ZONE 'America/New_York';
  v_eastern_time_only := v_eastern_time::time;
  v_day_of_week := lower(trim(to_char(v_eastern_time, 'Day')));

  -- Loop through all active stores that have closing_hours configured
  FOR v_store IN
    SELECT id, closing_hours
    FROM public.stores
    WHERE active = true
      AND closing_hours IS NOT NULL
  LOOP
    -- Get closing time for today's day of week
    v_closing_time_str := v_store.closing_hours ->> v_day_of_week;

    IF v_closing_time_str IS NOT NULL THEN
      v_closing_time := v_closing_time_str::time;

      -- If current Eastern time is past this store's closing time, clear its queue
      IF v_eastern_time_only >= v_closing_time THEN
        DELETE FROM public.technician_ready_queue
        WHERE store_id = v_store.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- FUNCTION: auto_checkout_employees_by_context (updated with queue cleanup)
-- ============================================================================
-- Same logic as before but now also removes employees from the queue when
-- auto-checking them out.
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
  v_eastern_date := v_eastern_time::date;
  v_day_of_week := lower(trim(to_char(v_eastern_time, 'Day')));

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

-- ============================================================================
-- CRON JOBS: Unschedule any existing jobs first, then reschedule
-- ============================================================================

-- Clean up any pre-existing jobs with these names (idempotent)
DO $$
BEGIN
  -- Remove old-style individual queue release jobs if they somehow exist
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN (
    'auto-release-queue-closing',
    'auto-release-queue-1700-edt',
    'auto-release-queue-1700-est',
    'auto-release-queue-1730-edt',
    'auto-release-queue-1730-est',
    'auto-release-queue-2100-edt',
    'auto-release-queue-2100-est',
    'auto-checkout-2200-edt',
    'auto-checkout-2200-est',
    'auto-approve-tickets',
    'expire-violation-reports'
  );
EXCEPTION WHEN OTHERS THEN
  -- pg_cron may not have had any jobs yet; ignore errors
  NULL;
END;
$$;

-- 1. Queue auto-release: every 15 minutes, checks all stores dynamically
SELECT cron.schedule(
  'auto-release-queue-closing',
  '*/15 * * * *',
  $$SELECT public.auto_release_queue_at_closing()$$
);

-- 2. Auto-checkout (EDT): 02:00 UTC = 22:00 EDT
SELECT cron.schedule(
  'auto-checkout-2200-edt',
  '0 2 * * *',
  $$SELECT public.auto_checkout_employees_by_context()$$
);

-- 3. Auto-checkout (EST): 03:00 UTC = 22:00 EST
SELECT cron.schedule(
  'auto-checkout-2200-est',
  '0 3 * * *',
  $$SELECT public.auto_checkout_employees_by_context()$$
);

-- 4. Auto-approve expired tickets: every 15 minutes
SELECT cron.schedule(
  'auto-approve-tickets',
  '*/15 * * * *',
  $$SELECT public.auto_approve_expired_tickets()$$
);

-- 5. Expire violation reports: every 5 minutes
SELECT cron.schedule(
  'expire-violation-reports',
  '*/5 * * * *',
  $$SELECT public.expire_violation_reports()$$
);

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
