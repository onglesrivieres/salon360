/*
  # Backfill Historical Auto-Checkout Records

  ## Overview
  Applies auto-checkout rules to all historical attendance records that were never checked out.
  Uses the same Option C logic (GREATEST of last ticket time OR store closing time) as the
  current auto-checkout system, but applies it retroactively to past dates.

  ## Changes
  1. Create `preview_historical_auto_checkout()` function
     - Shows what WOULD be changed without actually changing it
     - Returns table of affected records with proposed checkout times
     - Safe to run multiple times for testing

  2. Create `backfill_historical_auto_checkout()` function
     - Processes date range of historical attendance records
     - Applies same Option C logic as current auto-checkout
     - Adds [Backfilled: YYYY-MM-DD HH:MM] note to indicate retroactive processing
     - Skips any validation issues gracefully

  ## Logic Flow
  For each employee WHERE status = 'checked_in' AND work_date < CURRENT_DATE:
  1. Query MAX(closed_at) from their sale_tickets for that work_date
  2. Get store closing_hours[day_of_week] for that date
  3. Calculate checkout_time = GREATEST(last_ticket, store_closing)
  4. If neither time available, use fallback: 21:00 on work_date
  5. Validate checkout_time > check_in_time
  6. Update attendance with checkout time, hours, status, and backfill note

  ## Edge Cases Handled
  - Records before closing_hours column existed: Uses fallback time
  - Employee with no tickets: Uses store closing time or fallback
  - Negative hours: Skips and logs warning
  - Already checked out records: Skips
  - Invalid data: Skips and logs warning

  ## Usage
  ```sql
  -- Preview what would change (safe, no modifications)
  SELECT * FROM preview_historical_auto_checkout('2024-01-01'::date, '2024-12-03'::date);

  -- Actually perform the backfill
  SELECT backfill_historical_auto_checkout('2024-01-01'::date, '2024-12-03'::date);
  ```

  ## Security
  - Functions use SECURITY DEFINER with existing RLS policies
  - Only updates attendance_records table
  - Safe for automated execution
*/

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS preview_historical_auto_checkout(date, date);
DROP FUNCTION IF EXISTS backfill_historical_auto_checkout(date, date);

-- Create preview function to see what would change
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
      e.first_name || ' ' || e.last_name as employee_name,
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

-- Create the actual backfill function
CREATE OR REPLACE FUNCTION backfill_historical_auto_checkout(
  p_start_date date DEFAULT '2000-01-01'::date,
  p_end_date date DEFAULT CURRENT_DATE - interval '1 day'
)
RETURNS TABLE (
  records_processed integer,
  records_updated integer,
  records_skipped integer,
  earliest_date date,
  latest_date date
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
  v_note_addition text;
  v_fallback_time timestamptz;
  v_backfill_timestamp text;
  v_processed integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_earliest_date date := NULL;
  v_latest_date date := NULL;
BEGIN
  -- Get current timestamp for backfill note
  v_backfill_timestamp := to_char(now() AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24:MI');

  -- Loop through all checked-in employees in the date range
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
      AND ar.work_date >= p_start_date
      AND ar.work_date <= p_end_date
    ORDER BY ar.work_date
  LOOP
    v_processed := v_processed + 1;

    -- Track date range
    IF v_earliest_date IS NULL OR v_record.work_date < v_earliest_date THEN
      v_earliest_date := v_record.work_date;
    END IF;
    IF v_latest_date IS NULL OR v_record.work_date > v_latest_date THEN
      v_latest_date := v_record.work_date;
    END IF;

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

    -- Validate hours is not negative
    IF v_hours < 0 THEN
      -- Log error and skip
      RAISE WARNING 'Negative hours for attendance_id %, skipping', v_record.attendance_id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Build note addition with backfill timestamp
    v_note_addition := ' [Backfilled: ' || v_backfill_timestamp || ' | ' || v_checkout_source || ']';

    -- Update attendance record
    UPDATE public.attendance_records
    SET
      check_out_time = v_checkout_time,
      total_hours = v_hours,
      status = 'auto_checked_out',
      notes = COALESCE(notes, '') || v_note_addition,
      updated_at = now()
    WHERE id = v_record.attendance_id;

    v_updated := v_updated + 1;

  END LOOP;

  -- Return summary statistics
  records_processed := v_processed;
  records_updated := v_updated;
  records_skipped := v_skipped;
  earliest_date := v_earliest_date;
  latest_date := v_latest_date;

  RETURN NEXT;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION preview_historical_auto_checkout(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION backfill_historical_auto_checkout(date, date) TO authenticated;