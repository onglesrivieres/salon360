/*
  # Fix Auto-Checkout Fallback Logic

  ## Problem
  Commission and daily employees get stuck in 'checked_in' status when:
  1. They have no ticket_items entries
  2. AND store closing_hours is NULL or missing

  The ELSE/CONTINUE block at line 126-129 silently skips these employees,
  leaving them permanently stuck in checked_in status.

  ## Solution
  Add fallback logic to ALWAYS check out employees, even if no ticket time
  or store closing time is available. Use current time (now()) as fallback
  when neither ticket time nor store closing time is found.

  ## Changes
  1. Replace CONTINUE with fallback to now()
  2. Add RAISE NOTICE for debugging when fallback is used
  3. Backfill any existing stuck records from previous days
*/

CREATE OR REPLACE FUNCTION auto_checkout_employees_by_context()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_note_addition text;
BEGIN
  -- Get current date in Eastern timezone
  v_eastern_time := now() AT TIME ZONE 'America/New_York';
  v_eastern_date := v_eastern_time::date;

  -- Get day of week (lowercase, trimmed)
  v_day_of_week := lower(trim(to_char(v_eastern_time, 'Day')));

  -- Loop through all checked-in employees for today
  FOR v_record IN
    SELECT
      ar.id as attendance_id,
      ar.employee_id,
      ar.store_id,
      ar.check_in_time,
      ar.work_date,
      ar.notes,
      s.closing_hours
    FROM public.attendance_records ar
    JOIN public.stores s ON ar.store_id = s.id
    WHERE ar.status = 'checked_in'
      AND ar.work_date = v_eastern_date
  LOOP
    -- Get the last ticket closing time for this employee today
    SELECT MAX(st.closed_at) INTO v_last_ticket_time
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = v_record.employee_id
      AND st.store_id = v_record.store_id
      AND st.ticket_date = v_record.work_date
      AND st.closed_at IS NOT NULL;

    -- Get store closing time for today's day of week
    v_store_closing_time := NULL;
    IF v_record.closing_hours IS NOT NULL THEN
      v_closing_time_str := v_record.closing_hours->>v_day_of_week;

      IF v_closing_time_str IS NOT NULL THEN
        -- Build closing time as timestamptz in Eastern timezone
        v_store_closing_time := (
          (v_record.work_date || ' ' || v_closing_time_str)::timestamp
          AT TIME ZONE 'America/New_York'
        );
      END IF;
    END IF;

    -- Determine checkout time using Option C logic: GREATEST of both times
    IF v_last_ticket_time IS NOT NULL AND v_store_closing_time IS NOT NULL THEN
      -- Both times available: use whichever is LATER
      IF v_last_ticket_time > v_store_closing_time THEN
        v_checkout_time := v_last_ticket_time;
        v_checkout_source := 'late_ticket';
      ELSE
        v_checkout_time := v_store_closing_time;
        v_checkout_source := 'store_hours';
      END IF;
    ELSIF v_last_ticket_time IS NOT NULL THEN
      -- Only ticket time available
      v_checkout_time := v_last_ticket_time;
      v_checkout_source := 'ticket_only';
    ELSIF v_store_closing_time IS NOT NULL THEN
      -- Only store closing time available
      v_checkout_time := v_store_closing_time;
      v_checkout_source := 'store_hours_only';
    ELSE
      -- FALLBACK: Use current time if nothing else available
      -- This ensures employee is NEVER stuck in checked_in status
      v_checkout_time := now();
      v_checkout_source := 'fallback_now';
      RAISE NOTICE 'Using fallback checkout for employee_id=%, attendance_id=%',
                   v_record.employee_id, v_record.attendance_id;
    END IF;

    -- Calculate hours worked
    v_hours := EXTRACT(EPOCH FROM (v_checkout_time - v_record.check_in_time)) / 3600;

    -- Validate hours is not negative
    IF v_hours < 0 THEN
      -- Log error and skip
      RAISE WARNING 'Negative hours for attendance_id %, skipping', v_record.attendance_id;
      CONTINUE;
    END IF;

    -- Build note addition
    v_note_addition := ' [Auto: ' || v_checkout_source || ']';

    -- Update attendance record
    UPDATE public.attendance_records
    SET
      check_out_time = v_checkout_time,
      total_hours = v_hours,
      status = 'auto_checked_out',
      notes = COALESCE(notes, '') || v_note_addition,
      updated_at = now()
    WHERE id = v_record.attendance_id;

  END LOOP;
END;
$$;

-- Backfill: Fix any stuck records from previous days
-- Uses GREATEST of (check_in + 8 hours, 5pm on work_date) as checkout time
UPDATE public.attendance_records
SET
  check_out_time = GREATEST(
    check_in_time + INTERVAL '8 hours',
    (work_date || ' 17:00:00')::timestamp AT TIME ZONE 'America/New_York'
  ),
  status = 'auto_checked_out',
  total_hours = EXTRACT(EPOCH FROM (
    GREATEST(
      check_in_time + INTERVAL '8 hours',
      (work_date || ' 17:00:00')::timestamp AT TIME ZONE 'America/New_York'
    ) - check_in_time
  )) / 3600,
  notes = COALESCE(notes, '') || ' [Backfill: stuck record fixed]',
  updated_at = now()
WHERE status = 'checked_in'
  AND work_date < (now() AT TIME ZONE 'America/New_York')::date;
