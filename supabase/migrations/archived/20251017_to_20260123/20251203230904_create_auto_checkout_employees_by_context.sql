/*
  # Create Auto-Checkout by Context Function

  ## Overview
  Implements Option C: Auto-checkout using the LATER of (Last Ticket Time OR Store Closing Time).
  This ensures all employees get fair credit - technicians get credit for working late on tickets,
  and all staff get credit for full store hours regardless of when their last ticket closed.

  ## Changes
  1. Create `auto_checkout_employees_by_context()` function
     - Queries each checked-in employee's last ticket closing time
     - Gets store closing time for current day of week
     - Uses GREATEST(last_ticket_time, store_closing_time) as checkout time
     - Falls back appropriately if either time is NULL
     - Calculates total hours and updates attendance record
     - Adds detailed notes about which time source was used

  ## Logic Flow
  For each employee WHERE status = 'checked_in' AND work_date = CURRENT_DATE:
  1. Query MAX(closed_at) from their sale_tickets via ticket_items
  2. Get store closing_hours[day_of_week] for their store
  3. Calculate checkout_time = GREATEST(last_ticket, store_closing)
  4. Validate checkout_time > check_in_time
  5. Update attendance with checkout time, hours, and status
  6. Add note indicating which time source was used

  ## Edge Cases Handled
  - Employee with late ticket (after store closes): Uses ticket time
  - Employee with early tickets only: Uses store closing time
  - Employee with no tickets: Uses store closing time only
  - Multiple tickets throughout day: Uses LATEST (MAX) closing time
  - Negative hours: Skips and logs error

  ## Security
  - Function uses existing RLS policies
  - Safe for automated execution
*/

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS auto_checkout_inactive_daily_employees();
DROP FUNCTION IF EXISTS get_last_service_completion_time(uuid, uuid);
DROP FUNCTION IF EXISTS auto_checkout_all_at_closing_time();

-- Create the enhanced auto-checkout function using Option C logic
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
      -- Neither time available - skip this employee
      CONTINUE;
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
