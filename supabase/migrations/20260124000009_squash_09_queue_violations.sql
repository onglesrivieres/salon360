/*
  # Squashed Migration: Queue Violation System

  ## Overview
  This migration consolidates queue violation migrations for the
  voting-based violation reporting system with expiration.

  ## Tables Created
  - queue_violation_reports: Violation reports with vote tracking
  - queue_violation_responses: Employee votes on violations
  - queue_violation_actions: Actions taken on confirmed violations

  ## Functions Created
  - create_queue_violation_report: Create report with responders
  - submit_violation_response: Submit vote with threshold checking
  - expire_violation_reports: Auto-expire uncompleted reports
*/

-- ============================================================================
-- TABLE: queue_violation_reports
-- ============================================================================
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
  required_responder_ids uuid[] DEFAULT ARRAY[]::uuid[],
  manager_decision text CHECK (manager_decision IN ('violation_confirmed', 'no_violation', NULL)),
  manager_notes text,
  reviewed_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  expires_at timestamptz,
  min_votes_required_snapshot integer DEFAULT 3,
  insufficient_responders boolean DEFAULT false,
  votes_violation_confirmed integer DEFAULT 0,
  threshold_met boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_violation_reports_store_status ON public.queue_violation_reports(store_id, status);
CREATE INDEX IF NOT EXISTS idx_violation_reports_reported_employee ON public.queue_violation_reports(reported_employee_id);
CREATE INDEX IF NOT EXISTS idx_violation_reports_date ON public.queue_violation_reports(violation_date);

ALTER TABLE public.queue_violation_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to queue_violation_reports" ON public.queue_violation_reports;
CREATE POLICY "Allow all access to queue_violation_reports"
  ON public.queue_violation_reports FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: queue_violation_responses
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_violation_responses_report ON public.queue_violation_responses(violation_report_id);
CREATE INDEX IF NOT EXISTS idx_violation_responses_employee ON public.queue_violation_responses(employee_id);

ALTER TABLE public.queue_violation_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to queue_violation_responses" ON public.queue_violation_responses;
CREATE POLICY "Allow all access to queue_violation_responses"
  ON public.queue_violation_responses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: queue_violation_actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.queue_violation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_report_id uuid NOT NULL REFERENCES public.queue_violation_reports(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('warning', 'queue_removal', 'written_warning', 'suspension', 'none')),
  action_details text,
  created_by_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_violation_actions_report ON public.queue_violation_actions(violation_report_id);

ALTER TABLE public.queue_violation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to queue_violation_actions" ON public.queue_violation_actions;
CREATE POLICY "Allow all access to queue_violation_actions"
  ON public.queue_violation_actions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- FUNCTION: create_queue_violation_report
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_queue_violation_report(
  p_reported_employee_id uuid,
  p_reporter_employee_id uuid,
  p_store_id uuid,
  p_violation_description text,
  p_queue_position_claimed integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_report_id uuid;
  v_violation_date date;
  v_responders uuid[];
  v_total_responders integer;
  v_expires_at timestamptz;
  v_min_votes_required integer := 3;
  v_insufficient_responders boolean;
BEGIN
  v_violation_date := CURRENT_DATE;
  v_expires_at := now() + interval '60 minutes';

  IF p_reporter_employee_id = p_reported_employee_id THEN
    RAISE EXCEPTION 'Cannot report yourself for a violation';
  END IF;

  -- Get all employees who worked today, excluding reporter and reported
  SELECT array_agg(DISTINCT employee_id) INTO v_responders
  FROM public.attendance_records
  WHERE store_id = p_store_id AND check_in_time::date = v_violation_date
    AND employee_id NOT IN (p_reporter_employee_id, p_reported_employee_id);

  v_total_responders := COALESCE(array_length(v_responders, 1), 0);
  v_insufficient_responders := v_total_responders < v_min_votes_required;

  INSERT INTO public.queue_violation_reports (
    store_id, reported_employee_id, reporter_employee_id, violation_description, violation_date,
    queue_position_claimed, status, total_responses_required, total_responses_received, required_responder_ids,
    expires_at, min_votes_required_snapshot, insufficient_responders, votes_violation_confirmed, threshold_met
  ) VALUES (
    p_store_id, p_reported_employee_id, p_reporter_employee_id, p_violation_description, v_violation_date,
    p_queue_position_claimed, 'collecting_responses', v_total_responders, 0, COALESCE(v_responders, ARRAY[]::uuid[]),
    v_expires_at, v_min_votes_required, v_insufficient_responders, 0, false
  ) RETURNING id INTO v_report_id;

  RETURN jsonb_build_object(
    'success', true, 'report_id', v_report_id, 'total_responders', v_total_responders,
    'required_responders', COALESCE(v_responders, ARRAY[]::uuid[]), 'expires_at', v_expires_at,
    'min_votes_required', v_min_votes_required, 'insufficient_responders', v_insufficient_responders
  );
END;
$$;

-- ============================================================================
-- FUNCTION: submit_violation_response
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_violation_response(
  p_violation_report_id uuid,
  p_employee_id uuid,
  p_response boolean,
  p_response_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_report record;
  v_new_total integer;
  v_new_yes_votes integer;
  v_threshold_met boolean;
BEGIN
  SELECT * INTO v_report FROM public.queue_violation_reports WHERE id = p_violation_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Violation report not found'; END IF;
  IF v_report.status != 'collecting_responses' THEN RAISE EXCEPTION 'Report no longer accepting responses'; END IF;
  IF EXISTS (SELECT 1 FROM public.queue_violation_responses WHERE violation_report_id = p_violation_report_id AND employee_id = p_employee_id) THEN
    RAISE EXCEPTION 'Already responded to this report';
  END IF;

  INSERT INTO public.queue_violation_responses (violation_report_id, employee_id, response, response_notes)
  VALUES (p_violation_report_id, p_employee_id, p_response, p_response_notes);

  UPDATE public.queue_violation_reports
  SET total_responses_received = total_responses_received + 1,
      votes_violation_confirmed = votes_violation_confirmed + CASE WHEN p_response THEN 1 ELSE 0 END
  WHERE id = p_violation_report_id
  RETURNING total_responses_received, votes_violation_confirmed INTO v_new_total, v_new_yes_votes;

  v_threshold_met := v_new_yes_votes >= v_report.min_votes_required_snapshot;
  UPDATE public.queue_violation_reports SET threshold_met = v_threshold_met WHERE id = p_violation_report_id;

  IF v_new_total >= v_report.total_responses_required THEN
    UPDATE public.queue_violation_reports SET status = 'pending_approval' WHERE id = p_violation_report_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'responses_received', v_new_total, 'responses_required', v_report.total_responses_required,
    'votes_violation_confirmed', v_new_yes_votes, 'min_votes_required', v_report.min_votes_required_snapshot,
    'threshold_met', v_threshold_met,
    'status', CASE WHEN v_new_total >= v_report.total_responses_required THEN 'pending_approval' ELSE 'collecting_responses' END
  );
END;
$$;

-- ============================================================================
-- FUNCTION: expire_violation_reports
-- ============================================================================
CREATE OR REPLACE FUNCTION public.expire_violation_reports()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_expired_count integer; v_expired_reports jsonb;
BEGIN
  WITH expired AS (
    UPDATE public.queue_violation_reports SET status = 'expired'
    WHERE status = 'collecting_responses' AND expires_at <= now()
    RETURNING id, store_id, reported_employee_id, votes_violation_confirmed, min_votes_required_snapshot, threshold_met, insufficient_responders
  )
  SELECT COUNT(*)::integer, jsonb_agg(jsonb_build_object(
    'report_id', id, 'store_id', store_id, 'votes_received', votes_violation_confirmed,
    'votes_required', min_votes_required_snapshot, 'threshold_met', threshold_met, 'insufficient_responders', insufficient_responders
  ))
  INTO v_expired_count, v_expired_reports FROM expired;

  RETURN jsonb_build_object('success', true, 'expired_count', COALESCE(v_expired_count, 0),
                            'expired_reports', COALESCE(v_expired_reports, '[]'::jsonb), 'processed_at', now());
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
