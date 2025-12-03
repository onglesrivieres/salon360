/*
  # Fix Column Names in Backfill Functions

  ## Changes
  - Update preview_historical_auto_checkout to use correct column names
  - Use display_name instead of first_name || last_name
*/

-- Drop and recreate the preview function with correct column names
DROP FUNCTION IF EXISTS preview_historical_auto_checkout(date, date);

CREATE OR REPLACE FUNCTION preview_historical_auto_checkout(
  p_start_date date DEFAULT '2000-01-01'::date,
  p_end_date date DEFAULT CURRENT_DATE - interval '1 day'
)
RETURNS TABLE (
  attendance_id uuid,
  employee_id uuid,
  employee_name text,
  store_code text,
  work_date date,
  check_in_time timestamptz,
  proposed_checkout_time timestamptz,
  proposed_hours numeric,
  checkout_source text,
  current_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record RECORD;
  v_last_ticket_time timestamptz;
  v_store_closing_time timestamptz;
  v_checkout_time timestamptz;
  v_hours numeric;
  v_day_of_week text;
  v_closing_time_str text;
  v_checkout_source text;
  v_fallback_time timestamptz;
BEGIN
  -- Loop through all checked-in employees in the date range
  FOR v_record IN
    SELECT
      ar.id as attendance_id,
      ar.employee_id,
      ar.store_id,
      ar.check_in_time,
      ar.work_date,
      ar.status,
      e.display_name as employee_name,
      s.code as store_code,
      s.closing_hours
    FROM public.attendance_records ar
    JOIN public.employees e ON ar.employee_id = e.id
    JOIN public.stores s ON ar.store_id = s.id
    WHERE ar.status = 'checked_in'
      AND ar.work_date >= p_start_date
      AND ar.work_date <= p_end_date
    ORDER BY ar.work_date, ar.check_in_time
  LOOP
    -- Get day of week for this specific date
    v_day_of_week := lower(trim(to_char(v_record.work_date, 'Day')));

    -- Get the last ticket closing time for this employee on this date
    SELECT MAX(st.closed_at) INTO v_last_ticket_time
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = v_record.employee_id
      AND st.store_id = v_record.store_id
      AND st.ticket_date = v_record.work_date
      AND st.closed_at IS NOT NULL;

    -- Get store closing time for this day of week
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

    -- Fallback time: 21:00 on the work date (for dates before closing_hours existed)
    v_fallback_time := (
      (v_record.work_date || ' 21:00:00')::timestamp
      AT TIME ZONE 'America/New_York'
    );

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
      -- Neither time available - use fallback
      v_checkout_time := v_fallback_time;
      v_checkout_source := 'fallback_21:00';
    END IF;

    -- Calculate hours worked
    v_hours := EXTRACT(EPOCH FROM (v_checkout_time - v_record.check_in_time)) / 3600;

    -- Skip if hours is negative (data issue)
    IF v_hours < 0 THEN
      CONTINUE;
    END IF;

    -- Return this preview row
    attendance_id := v_record.attendance_id;
    employee_id := v_record.employee_id;
    employee_name := v_record.employee_name;
    store_code := v_record.store_code;
    work_date := v_record.work_date;
    check_in_time := v_record.check_in_time;
    proposed_checkout_time := v_checkout_time;
    proposed_hours := v_hours;
    checkout_source := v_checkout_source;
    current_status := v_record.status;

    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION preview_historical_auto_checkout(date, date) TO authenticated;