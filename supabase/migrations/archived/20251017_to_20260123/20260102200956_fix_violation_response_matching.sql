/*
  # Fix Violation Response Matching Issue

  1. Changes
    - Add `required_responder_ids` column to store the exact list of employees who need to respond
    - Update `create_queue_violation_report` to populate this list
    - Update `get_pending_violation_responses` to check against this list instead of doing attendance lookups

  2. Rationale
    - Previously, responders were counted at report creation time (currently checked in employees)
    - But the get function checked for any attendance record on that date
    - This mismatch caused employees who should respond to not see the response ribbon
    - By storing and checking against an explicit list, we ensure consistency
*/

-- Add column to store required responder IDs
ALTER TABLE public.queue_violation_reports
ADD COLUMN IF NOT EXISTS required_responder_ids uuid[] DEFAULT ARRAY[]::uuid[];

-- Update the create function to store required responder IDs
CREATE OR REPLACE FUNCTION public.create_queue_violation_report(
  p_reported_employee_id uuid,
  p_reporter_employee_id uuid,
  p_store_id uuid,
  p_violation_description text,
  p_queue_position_claimed integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_id uuid;
  v_violation_date date;
  v_responders uuid[];
  v_total_responders integer;
  v_expires_at timestamptz;
BEGIN
  -- Get current date in EST
  v_violation_date := CURRENT_DATE;

  -- Set expiration to 24 hours from now
  v_expires_at := now() + interval '24 hours';

  -- Validate: reporter and reported employee are different
  IF p_reporter_employee_id = p_reported_employee_id THEN
    RAISE EXCEPTION 'Cannot report yourself for a violation';
  END IF;

  -- Get all employees checked in today (excluding reporter and reported employee)
  SELECT array_agg(DISTINCT employee_id)
  INTO v_responders
  FROM public.attendance_records
  WHERE store_id = p_store_id
    AND check_in_time::date = v_violation_date
    AND employee_id NOT IN (p_reporter_employee_id, p_reported_employee_id)
    AND check_out_time IS NULL;

  -- Count total responders
  v_total_responders := COALESCE(array_length(v_responders, 1), 0);

  -- Create the violation report with explicit responder list
  INSERT INTO public.queue_violation_reports (
    store_id,
    reported_employee_id,
    reporter_employee_id,
    violation_description,
    violation_date,
    queue_position_claimed,
    status,
    total_responses_required,
    total_responses_received,
    required_responder_ids,
    expires_at
  ) VALUES (
    p_store_id,
    p_reported_employee_id,
    p_reporter_employee_id,
    p_violation_description,
    v_violation_date,
    p_queue_position_claimed,
    'collecting_responses',
    v_total_responders,
    0,
    COALESCE(v_responders, ARRAY[]::uuid[]),
    v_expires_at
  )
  RETURNING id INTO v_report_id;

  -- Return success with report details
  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'total_responders', v_total_responders,
    'required_responders', COALESCE(v_responders, ARRAY[]::uuid[]),
    'expires_at', v_expires_at
  );
END;
$$;

-- Update the get function to check against explicit responder list
CREATE OR REPLACE FUNCTION public.get_pending_violation_responses(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS TABLE (
  report_id uuid,
  reported_employee_id uuid,
  reported_employee_name text,
  reporter_employee_id uuid,
  reporter_employee_name text,
  violation_description text,
  violation_date date,
  queue_position_claimed integer,
  total_responses_required integer,
  total_responses_received integer,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vr.id,
    vr.reported_employee_id,
    reported.display_name,
    vr.reporter_employee_id,
    reporter.display_name,
    vr.violation_description,
    vr.violation_date,
    vr.queue_position_claimed,
    vr.total_responses_required,
    vr.total_responses_received,
    vr.expires_at,
    vr.created_at
  FROM public.queue_violation_reports vr
  JOIN public.employees reported ON reported.id = vr.reported_employee_id
  JOIN public.employees reporter ON reporter.id = vr.reporter_employee_id
  WHERE vr.store_id = p_store_id
    AND vr.status = 'collecting_responses'
    AND p_employee_id = ANY(vr.required_responder_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.queue_violation_responses
      WHERE violation_report_id = vr.id AND employee_id = p_employee_id
    )
  ORDER BY vr.created_at ASC;
END;
$$;

-- Update get_violation_reports_for_approval to use display_name
CREATE OR REPLACE FUNCTION public.get_violation_reports_for_approval(
  p_store_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  report_id uuid,
  reported_employee_id uuid,
  reported_employee_name text,
  reporter_employee_id uuid,
  reporter_employee_name text,
  violation_description text,
  violation_date date,
  queue_position_claimed integer,
  total_responses integer,
  votes_for_violation integer,
  votes_against_violation integer,
  response_details jsonb,
  created_at timestamptz,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vr.id,
    vr.reported_employee_id,
    reported.display_name,
    vr.reporter_employee_id,
    reporter.display_name,
    vr.violation_description,
    vr.violation_date,
    vr.queue_position_claimed,
    vr.total_responses_received,
    (SELECT COUNT(*) FROM public.queue_violation_responses WHERE violation_report_id = vr.id AND response = true)::integer,
    (SELECT COUNT(*) FROM public.queue_violation_responses WHERE violation_report_id = vr.id AND response = false)::integer,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'employee_id', resp.employee_id,
          'employee_name', e.display_name,
          'response', resp.response,
          'response_notes', resp.response_notes,
          'responded_at', resp.responded_at
        ) ORDER BY resp.responded_at
      )
      FROM public.queue_violation_responses resp
      JOIN public.employees e ON e.id = resp.employee_id
      WHERE resp.violation_report_id = vr.id
    ),
    vr.created_at,
    vr.status
  FROM public.queue_violation_reports vr
  JOIN public.employees reported ON reported.id = vr.reported_employee_id
  JOIN public.employees reporter ON reporter.id = vr.reporter_employee_id
  WHERE vr.store_id = p_store_id
    AND vr.status = 'pending_approval'
    AND (p_start_date IS NULL OR vr.violation_date >= p_start_date)
    AND (p_end_date IS NULL OR vr.violation_date <= p_end_date)
  ORDER BY vr.created_at ASC;
END;
$$;
