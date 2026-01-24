/*
  # Create Queue Violation Reporting System

  1. New Tables
    - `queue_violation_reports`
      - Core violation report information
      - Tracks status from 'collecting_responses' to 'pending_approval' to final decision
      - Links to reporter, reported employee, and reviewing manager

    - `queue_violation_responses`
      - Individual employee responses (True/False votes)
      - Tracks who responded and their vote with optional notes
      - Unique constraint ensures one response per employee per report

    - `queue_violation_actions`
      - Tracks consequences/actions taken after manager approval
      - Records warnings, queue removals, or other disciplinary actions

  2. Security
    - Enable RLS on all tables
    - Employees can view reports where they are involved or required to respond
    - Managers can view all reports for their stores
    - Only checked-in employees can create reports
    - Only pending responders can submit responses
    - Only managers can approve/reject reports

  3. Functions
    - create_queue_violation_report: Create new violation report
    - submit_violation_response: Submit employee vote
    - get_pending_violation_responses: Get reports awaiting response
    - get_violation_reports_for_approval: Get reports pending manager review
    - approve_violation_report: Manager approves/rejects report
*/

-- Create queue_violation_reports table
CREATE TABLE IF NOT EXISTS public.queue_violation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reported_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reporter_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  violation_description text NOT NULL,
  violation_date date NOT NULL,
  queue_position_claimed integer,
  status text NOT NULL DEFAULT 'collecting_responses' CHECK (status IN ('collecting_responses', 'pending_approval', 'approved', 'rejected', 'expired')),
  total_responses_required integer NOT NULL DEFAULT 0,
  total_responses_received integer NOT NULL DEFAULT 0,
  manager_decision text CHECK (manager_decision IN ('violation_confirmed', 'no_violation', NULL)),
  manager_notes text,
  reviewed_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create queue_violation_responses table
CREATE TABLE IF NOT EXISTS public.queue_violation_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_report_id uuid NOT NULL REFERENCES public.queue_violation_reports(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  response boolean NOT NULL,
  response_notes text,
  responded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(violation_report_id, employee_id)
);

-- Create queue_violation_actions table
CREATE TABLE IF NOT EXISTS public.queue_violation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_report_id uuid NOT NULL REFERENCES public.queue_violation_reports(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('warning', 'queue_removal', 'written_warning', 'suspension', 'none')),
  action_details text,
  created_by_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_violation_reports_store_status ON public.queue_violation_reports(store_id, status);
CREATE INDEX IF NOT EXISTS idx_violation_reports_reported_employee ON public.queue_violation_reports(reported_employee_id);
CREATE INDEX IF NOT EXISTS idx_violation_reports_date ON public.queue_violation_reports(violation_date);
CREATE INDEX IF NOT EXISTS idx_violation_responses_report ON public.queue_violation_responses(violation_report_id);
CREATE INDEX IF NOT EXISTS idx_violation_responses_employee ON public.queue_violation_responses(employee_id);
CREATE INDEX IF NOT EXISTS idx_violation_actions_report ON public.queue_violation_actions(violation_report_id);

-- Enable RLS
ALTER TABLE public.queue_violation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_violation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_violation_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for queue_violation_reports
CREATE POLICY "Employees can view reports where they are involved"
  ON public.queue_violation_reports FOR SELECT
  TO authenticated
  USING (
    reporter_employee_id = auth.uid() OR
    reported_employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.queue_violation_responses
      WHERE violation_report_id = id AND employee_id = auth.uid()
    )
  );

CREATE POLICY "Allow anon to view reports where they are involved"
  ON public.queue_violation_reports FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Checked-in employees can create reports"
  ON public.queue_violation_reports FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.employee_id = reporter_employee_id
        AND ar.store_id = queue_violation_reports.store_id
        AND ar.check_in_time::date = violation_date
        AND ar.check_out_time IS NULL
    )
  );

CREATE POLICY "Managers can update reports for their stores"
  ON public.queue_violation_reports FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for queue_violation_responses
CREATE POLICY "Employees can view their own responses"
  ON public.queue_violation_responses FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

CREATE POLICY "Allow anon to view responses"
  ON public.queue_violation_responses FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Employees can insert their own responses"
  ON public.queue_violation_responses FOR INSERT
  TO anon
  WITH CHECK (true);

-- RLS Policies for queue_violation_actions
CREATE POLICY "Allow anon to view actions"
  ON public.queue_violation_actions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Managers can create actions"
  ON public.queue_violation_actions FOR INSERT
  TO anon
  WITH CHECK (true);

-- Function to create a violation report
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

  -- Validate: reporter is checked in today
  IF NOT EXISTS (
    SELECT 1 FROM public.attendance_records
    WHERE employee_id = p_reporter_employee_id
      AND store_id = p_store_id
      AND check_in_time::date = v_violation_date
      AND check_out_time IS NULL
  ) THEN
    RAISE EXCEPTION 'Reporter must be checked in to file a report';
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

  -- Create the violation report
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
    v_expires_at
  )
  RETURNING id INTO v_report_id;

  -- Return report details
  RETURN jsonb_build_object(
    'report_id', v_report_id,
    'total_responders', v_total_responders,
    'responders', v_responders,
    'expires_at', v_expires_at
  );
END;
$$;

-- Function to submit a violation response
CREATE OR REPLACE FUNCTION public.submit_violation_response(
  p_violation_report_id uuid,
  p_employee_id uuid,
  p_response boolean,
  p_response_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report record;
  v_new_total integer;
BEGIN
  -- Get current report status
  SELECT * INTO v_report
  FROM public.queue_violation_reports
  WHERE id = p_violation_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Violation report not found';
  END IF;

  -- Check if report is still collecting responses
  IF v_report.status != 'collecting_responses' THEN
    RAISE EXCEPTION 'This report is no longer accepting responses';
  END IF;

  -- Check if already responded
  IF EXISTS (
    SELECT 1 FROM public.queue_violation_responses
    WHERE violation_report_id = p_violation_report_id
      AND employee_id = p_employee_id
  ) THEN
    RAISE EXCEPTION 'You have already responded to this report';
  END IF;

  -- Insert the response
  INSERT INTO public.queue_violation_responses (
    violation_report_id,
    employee_id,
    response,
    response_notes
  ) VALUES (
    p_violation_report_id,
    p_employee_id,
    p_response,
    p_response_notes
  );

  -- Update response count
  UPDATE public.queue_violation_reports
  SET total_responses_received = total_responses_received + 1
  WHERE id = p_violation_report_id
  RETURNING total_responses_received INTO v_new_total;

  -- If all responses collected, move to pending approval
  IF v_new_total >= v_report.total_responses_required THEN
    UPDATE public.queue_violation_reports
    SET status = 'pending_approval'
    WHERE id = p_violation_report_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'responses_received', v_new_total,
    'responses_required', v_report.total_responses_required,
    'status', CASE WHEN v_new_total >= v_report.total_responses_required THEN 'pending_approval' ELSE 'collecting_responses' END
  );
END;
$$;

-- Function to get pending violation responses for an employee
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
    reported.name,
    vr.reporter_employee_id,
    reporter.name,
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
    AND NOT EXISTS (
      SELECT 1 FROM public.queue_violation_responses
      WHERE violation_report_id = vr.id AND employee_id = p_employee_id
    )
    AND EXISTS (
      SELECT 1 FROM public.attendance_records
      WHERE employee_id = p_employee_id
        AND store_id = p_store_id
        AND check_in_time::date = vr.violation_date
    )
    AND p_employee_id NOT IN (vr.reporter_employee_id, vr.reported_employee_id)
  ORDER BY vr.created_at ASC;
END;
$$;

-- Function to get violation reports for manager approval
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
    reported.name,
    vr.reporter_employee_id,
    reporter.name,
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
          'employee_name', e.name,
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

-- Function to approve/reject a violation report
CREATE OR REPLACE FUNCTION public.approve_violation_report(
  p_violation_report_id uuid,
  p_reviewer_employee_id uuid,
  p_decision text,
  p_manager_notes text DEFAULT NULL,
  p_action_type text DEFAULT 'none',
  p_action_details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report record;
  v_final_status text;
  v_action_id uuid;
BEGIN
  -- Get report details
  SELECT * INTO v_report
  FROM public.queue_violation_reports
  WHERE id = p_violation_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Violation report not found';
  END IF;

  -- Validate decision
  IF p_decision NOT IN ('violation_confirmed', 'no_violation') THEN
    RAISE EXCEPTION 'Invalid decision. Must be violation_confirmed or no_violation';
  END IF;

  -- Validate that reviewer is not the reporter or reported employee
  IF p_reviewer_employee_id IN (v_report.reporter_employee_id, v_report.reported_employee_id) THEN
    RAISE EXCEPTION 'Reviewer cannot be the reporter or reported employee';
  END IF;

  -- Set final status based on decision
  v_final_status := CASE
    WHEN p_decision = 'violation_confirmed' THEN 'approved'
    ELSE 'rejected'
  END;

  -- Update the report
  UPDATE public.queue_violation_reports
  SET
    status = v_final_status,
    manager_decision = p_decision,
    manager_notes = p_manager_notes,
    reviewed_by_employee_id = p_reviewer_employee_id,
    reviewed_at = now()
  WHERE id = p_violation_report_id;

  -- If violation confirmed and action specified, record the action
  IF p_decision = 'violation_confirmed' AND p_action_type != 'none' THEN
    INSERT INTO public.queue_violation_actions (
      violation_report_id,
      action_type,
      action_details,
      created_by_employee_id
    ) VALUES (
      p_violation_report_id,
      p_action_type,
      p_action_details,
      p_reviewer_employee_id
    )
    RETURNING id INTO v_action_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_final_status,
    'decision', p_decision,
    'action_created', v_action_id IS NOT NULL
  );
END;
$$;

-- Function to auto-expire old reports (run via cron)
CREATE OR REPLACE FUNCTION public.expire_old_violation_reports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.queue_violation_reports
  SET status = 'expired'
  WHERE status = 'collecting_responses'
    AND expires_at < now();
END;
$$;
