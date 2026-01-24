/*
  # Squashed Migration: Attendance System

  ## Overview
  This migration consolidates attendance migrations for employee check-in/out
  tracking with timezone support and change proposals.

  ## Tables Created
  - attendance_records: Daily attendance tracking
  - attendance_comments: Comments on attendance records
  - attendance_change_proposals: Time correction requests

  ## Functions Created
  - check_in_employee: Employee check-in with validation
  - check_out_employee: Employee check-out
  - get_store_attendance: Query attendance records
  - auto_checkout_employees_by_context: Scheduled auto-checkout
*/

-- ============================================================================
-- TABLE: attendance_records
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_out_time timestamptz,
  last_activity_time timestamptz,
  pay_type text NOT NULL CHECK (pay_type IN ('hourly', 'daily', 'commission')),
  status text NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'checked_out', 'auto_checked_out')),
  total_hours numeric(10,2),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_id ON public.attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_store_id ON public.attendance_records(store_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_work_date ON public.attendance_records(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_status ON public.attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_store_date ON public.attendance_records(employee_id, store_id, work_date);

-- Partial unique index for active check-ins
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_active_checkin_unique
ON public.attendance_records (employee_id, store_id, work_date)
WHERE status = 'checked_in' AND check_out_time IS NULL;

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to attendance_records" ON public.attendance_records;
CREATE POLICY "Allow all access to attendance_records"
  ON public.attendance_records FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: attendance_comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id uuid NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_comments_record_id ON public.attendance_comments(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_attendance_comments_employee_id ON public.attendance_comments(employee_id);

ALTER TABLE public.attendance_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to attendance_comments" ON public.attendance_comments;
CREATE POLICY "Allow all access to attendance_comments"
  ON public.attendance_comments FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: attendance_change_proposals
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id uuid NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  proposed_check_in_time timestamptz,
  proposed_check_out_time timestamptz,
  current_check_in_time timestamptz NOT NULL,
  current_check_out_time timestamptz,
  reason_comment text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT at_least_one_proposed_time CHECK (
    proposed_check_in_time IS NOT NULL OR proposed_check_out_time IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_attendance_change_proposals_record ON public.attendance_change_proposals(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_attendance_change_proposals_employee ON public.attendance_change_proposals(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_change_proposals_status ON public.attendance_change_proposals(status);

ALTER TABLE public.attendance_change_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to attendance_change_proposals" ON public.attendance_change_proposals;
CREATE POLICY "Allow all access to attendance_change_proposals"
  ON public.attendance_change_proposals FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FUNCTION: check_in_employee
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_in_employee(
  p_employee_id uuid,
  p_store_id uuid,
  p_pay_type text DEFAULT 'hourly'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_record_id uuid;
  v_work_date date;
  v_check_in_time timestamptz;
  v_store_timezone text;
  v_current_time time;
  v_checkin_allowed_time time := '08:45:00'::time;
  v_has_attendance_display boolean;
  v_employee_pay_type text;
  v_other_store_record RECORD;
  v_hours_worked numeric;
BEGIN
  v_store_timezone := public.get_store_timezone(p_store_id);
  v_work_date := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::date;
  v_check_in_time := CURRENT_TIMESTAMP;
  v_current_time := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::time;

  -- Validate check-in time
  IF v_current_time < v_checkin_allowed_time THEN
    RAISE EXCEPTION 'Check-in is available starting at 8:45 AM EST daily';
  END IF;

  -- Get employee details
  SELECT COALESCE(attendance_display, true), pay_type
  INTO v_has_attendance_display, v_employee_pay_type
  FROM public.employees WHERE id = p_employee_id;

  IF v_employee_pay_type = 'commission' THEN
    RAISE EXCEPTION 'Attendance tracking is not available for commission-based employees';
  END IF;

  IF NOT v_has_attendance_display THEN
    RAISE EXCEPTION 'Employee is not enabled for attendance tracking';
  END IF;

  -- Check if already checked in at this store
  SELECT id INTO v_record_id
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = v_work_date
    AND status = 'checked_in'
    AND check_out_time IS NULL
  ORDER BY check_in_time DESC LIMIT 1;

  IF v_record_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'work_date', v_work_date, 'check_in_time', v_check_in_time, 'already_checked_in', true, 'record_id', v_record_id);
  END IF;

  -- Auto check-out from other stores
  FOR v_other_store_record IN
    SELECT id, store_id, check_in_time, work_date
    FROM public.attendance_records
    WHERE employee_id = p_employee_id
      AND store_id != p_store_id
      AND status = 'checked_in'
      AND check_out_time IS NULL
  LOOP
    v_hours_worked := EXTRACT(EPOCH FROM (v_check_in_time - v_other_store_record.check_in_time)) / 3600;
    UPDATE public.attendance_records
    SET check_out_time = v_check_in_time, status = 'auto_checked_out', total_hours = v_hours_worked,
        updated_at = v_check_in_time, notes = COALESCE(notes || ' ', '') || 'Auto checked-out due to check-in at another store'
    WHERE id = v_other_store_record.id;
  END LOOP;

  -- Insert new attendance record
  INSERT INTO public.attendance_records (employee_id, store_id, work_date, check_in_time, last_activity_time, status, pay_type)
  VALUES (p_employee_id, p_store_id, v_work_date, v_check_in_time, v_check_in_time, 'checked_in', COALESCE(p_pay_type, v_employee_pay_type, 'hourly'))
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object('success', true, 'work_date', v_work_date, 'check_in_time', v_check_in_time, 'already_checked_in', false, 'record_id', v_record_id);
END;
$$;

-- ============================================================================
-- FUNCTION: check_out_employee
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_out_employee(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_check_in_time timestamptz;
  v_hours numeric;
  v_record_id uuid;
  v_work_date date;
  v_store_timezone text;
  v_has_attendance_display boolean;
  v_employee_pay_type text;
BEGIN
  v_store_timezone := public.get_store_timezone(p_store_id);
  v_work_date := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::date;

  SELECT COALESCE(attendance_display, true), pay_type
  INTO v_has_attendance_display, v_employee_pay_type
  FROM public.employees WHERE id = p_employee_id;

  IF v_employee_pay_type = 'commission' THEN
    RAISE EXCEPTION 'Attendance tracking is not available for commission-based employees';
  END IF;

  IF NOT v_has_attendance_display THEN
    RAISE EXCEPTION 'Employee is not enabled for attendance tracking';
  END IF;

  SELECT id, check_in_time INTO v_record_id, v_check_in_time
  FROM public.attendance_records
  WHERE employee_id = p_employee_id AND store_id = p_store_id
    AND work_date = v_work_date AND status = 'checked_in' AND check_out_time IS NULL
  ORDER BY check_in_time DESC LIMIT 1;

  IF v_check_in_time IS NULL THEN RETURN false; END IF;

  v_hours := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_check_in_time)) / 3600;

  UPDATE public.attendance_records
  SET check_out_time = CURRENT_TIMESTAMP, status = 'checked_out', total_hours = v_hours, updated_at = CURRENT_TIMESTAMP
  WHERE id = v_record_id;

  RETURN true;
END;
$$;

-- ============================================================================
-- FUNCTION: get_store_attendance
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_store_attendance(
  p_store_id uuid,
  p_start_date date,
  p_end_date date,
  p_employee_id uuid DEFAULT NULL
)
RETURNS TABLE (
  attendance_record_id uuid,
  employee_id uuid,
  employee_name text,
  work_date date,
  check_in_time timestamptz,
  check_out_time timestamptz,
  total_hours numeric,
  status text,
  pay_type text,
  store_code text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id as attendance_record_id,
    ar.employee_id,
    e.display_name as employee_name,
    ar.work_date,
    ar.check_in_time,
    ar.check_out_time,
    ar.total_hours,
    ar.status,
    e.pay_type,
    s.code as store_code
  FROM public.attendance_records ar
  JOIN public.employees e ON ar.employee_id = e.id
  JOIN public.stores s ON ar.store_id = s.id
  WHERE ar.employee_id IN (SELECT es.employee_id FROM public.employee_stores es WHERE es.store_id = p_store_id)
    AND ar.work_date BETWEEN p_start_date AND p_end_date
    AND (p_employee_id IS NULL OR ar.employee_id = p_employee_id)
    AND (e.attendance_display IS NULL OR e.attendance_display = true)
  ORDER BY ar.work_date DESC, ar.check_in_time ASC;
END;
$$;

-- ============================================================================
-- FUNCTION: auto_checkout_employees_by_context
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_checkout_employees_by_context()
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
  END LOOP;
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
