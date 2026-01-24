/*
  # Add Violation Report Additional Information Feature

  ## Overview
  This migration adds the ability for management to request additional information
  from reporters on violation reports, and for reporters to provide that information.

  ## Changes

  ### Columns Added to queue_violation_reports
  - `info_requested_at` - When info was requested
  - `info_requested_by` - Employee who requested info
  - `info_request_message` - Optional question/prompt from management
  - `additional_info` - Reporter's additional information
  - `additional_info_submitted_at` - When additional info was submitted

  ### Functions Created
  - `request_violation_additional_info` - Management requests more info
  - `submit_violation_additional_info` - Reporter submits additional info

  ### Functions Updated
  - `get_violation_reports_for_approval` - Returns new fields
  - `get_all_violation_reports_for_management` - Returns new fields
*/

-- ============================================================================
-- ADD COLUMNS TO queue_violation_reports
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'queue_violation_reports'
      AND column_name = 'info_requested_at'
  ) THEN
    ALTER TABLE public.queue_violation_reports ADD COLUMN info_requested_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'queue_violation_reports'
      AND column_name = 'info_requested_by'
  ) THEN
    ALTER TABLE public.queue_violation_reports ADD COLUMN info_requested_by UUID REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'queue_violation_reports'
      AND column_name = 'info_request_message'
  ) THEN
    ALTER TABLE public.queue_violation_reports ADD COLUMN info_request_message TEXT DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'queue_violation_reports'
      AND column_name = 'additional_info'
  ) THEN
    ALTER TABLE public.queue_violation_reports ADD COLUMN additional_info TEXT DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'queue_violation_reports'
      AND column_name = 'additional_info_submitted_at'
  ) THEN
    ALTER TABLE public.queue_violation_reports ADD COLUMN additional_info_submitted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- ============================================================================
-- FUNCTION: request_violation_additional_info
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_violation_additional_info(
  p_violation_report_id UUID,
  p_requested_by UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.queue_violation_reports
  SET
    info_requested_at = NOW(),
    info_requested_by = p_requested_by,
    info_request_message = p_message
  WHERE id = p_violation_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_violation_additional_info TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_violation_additional_info TO anon;

-- ============================================================================
-- FUNCTION: submit_violation_additional_info
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_violation_additional_info(
  p_violation_report_id UUID,
  p_reporter_id UUID,
  p_additional_info TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the submitter is the original reporter
  IF NOT EXISTS (
    SELECT 1 FROM public.queue_violation_reports
    WHERE id = p_violation_report_id AND reporter_employee_id = p_reporter_id
  ) THEN
    RAISE EXCEPTION 'Only the original reporter can submit additional information';
  END IF;

  UPDATE public.queue_violation_reports
  SET
    additional_info = p_additional_info,
    additional_info_submitted_at = NOW()
  WHERE id = p_violation_report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_violation_additional_info TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_violation_additional_info TO anon;

-- ============================================================================
-- UPDATE FUNCTION: get_violation_reports_for_approval
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_violation_reports_for_approval(uuid, date, date);

CREATE FUNCTION public.get_violation_reports_for_approval(
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
  status text,
  expires_at timestamptz,
  votes_violation_confirmed integer,
  min_votes_required integer,
  threshold_met boolean,
  insufficient_responders boolean,
  info_requested_at timestamptz,
  info_requested_by uuid,
  info_requested_by_name text,
  info_request_message text,
  additional_info text,
  additional_info_submitted_at timestamptz
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
    vr.status,
    vr.expires_at,
    vr.votes_violation_confirmed,
    vr.min_votes_required_snapshot,
    vr.threshold_met,
    vr.insufficient_responders,
    vr.info_requested_at,
    vr.info_requested_by,
    requester.display_name,
    vr.info_request_message,
    vr.additional_info,
    vr.additional_info_submitted_at
  FROM public.queue_violation_reports vr
  JOIN public.employees reported ON reported.id = vr.reported_employee_id
  JOIN public.employees reporter ON reporter.id = vr.reporter_employee_id
  LEFT JOIN public.employees requester ON requester.id = vr.info_requested_by
  WHERE vr.store_id = p_store_id
    AND vr.status IN ('pending_approval', 'expired')
    AND (p_start_date IS NULL OR vr.violation_date >= p_start_date)
    AND (p_end_date IS NULL OR vr.violation_date <= p_end_date)
  ORDER BY
    -- Sort by urgency: pending_approval first, then expired, then by creation time
    CASE vr.status
      WHEN 'pending_approval' THEN 1
      WHEN 'expired' THEN 2
      ELSE 3
    END,
    vr.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_violation_reports_for_approval TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_violation_reports_for_approval TO anon;

-- ============================================================================
-- UPDATE FUNCTION: get_all_violation_reports_for_management
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_all_violation_reports_for_management(uuid, text, date, date, text);

CREATE OR REPLACE FUNCTION public.get_all_violation_reports_for_management(
  p_store_id uuid,
  p_status text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_search_employee text DEFAULT NULL
)
RETURNS TABLE (
  report_id uuid,
  reported_employee_id uuid,
  reported_employee_name text,
  reporter_employee_id uuid,
  reporter_employee_name text,
  violation_description text,
  violation_date date,
  queue_position integer,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  reviewed_by_id uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  decision text,
  action_type text,
  action_details text,
  manager_notes text,
  total_required_responders integer,
  total_responses integer,
  votes_violation integer,
  votes_no_violation integer,
  responses jsonb,
  info_requested_at timestamptz,
  info_requested_by uuid,
  info_requested_by_name text,
  info_request_message text,
  additional_info text,
  additional_info_submitted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    vr.id AS report_id,
    vr.reported_employee_id,
    reported_emp.display_name AS reported_employee_name,
    vr.reporter_employee_id,
    reporter_emp.display_name AS reporter_employee_name,
    vr.violation_description,
    vr.violation_date,
    vr.queue_position_claimed AS queue_position,
    vr.status,
    vr.created_at,
    vr.expires_at,
    vr.reviewed_by_employee_id AS reviewed_by_id,
    reviewed_emp.display_name AS reviewed_by_name,
    vr.reviewed_at,
    vr.manager_decision AS decision,
    va.action_type,
    va.action_details,
    vr.manager_notes,
    vr.total_responses_required AS total_required_responders,
    (
      SELECT COUNT(*)::integer
      FROM public.queue_violation_responses vresp
      WHERE vresp.violation_report_id = vr.id
    ) AS total_responses,
    (
      SELECT COUNT(*)::integer
      FROM public.queue_violation_responses vresp
      WHERE vresp.violation_report_id = vr.id
        AND vresp.response = true
    ) AS votes_violation,
    (
      SELECT COUNT(*)::integer
      FROM public.queue_violation_responses vresp
      WHERE vresp.violation_report_id = vr.id
        AND vresp.response = false
    ) AS votes_no_violation,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'response_id', vresp.id,
          'responder_employee_id', vresp.employee_id,
          'responder_employee_name', resp_emp.display_name,
          'vote', CASE WHEN vresp.response = true THEN 'violation' ELSE 'no_violation' END,
          'notes', vresp.response_notes,
          'responded_at', vresp.responded_at
        )
        ORDER BY vresp.responded_at DESC
      )
      FROM public.queue_violation_responses vresp
      LEFT JOIN public.employees resp_emp ON resp_emp.id = vresp.employee_id
      WHERE vresp.violation_report_id = vr.id
    ) AS responses,
    vr.info_requested_at,
    vr.info_requested_by,
    requester_emp.display_name AS info_requested_by_name,
    vr.info_request_message,
    vr.additional_info,
    vr.additional_info_submitted_at
  FROM public.queue_violation_reports vr
  LEFT JOIN public.employees reported_emp ON reported_emp.id = vr.reported_employee_id
  LEFT JOIN public.employees reporter_emp ON reporter_emp.id = vr.reporter_employee_id
  LEFT JOIN public.employees reviewed_emp ON reviewed_emp.id = vr.reviewed_by_employee_id
  LEFT JOIN public.employees requester_emp ON requester_emp.id = vr.info_requested_by
  LEFT JOIN public.queue_violation_actions va ON va.violation_report_id = vr.id
  WHERE vr.store_id = p_store_id
    AND (p_status IS NULL OR vr.status = p_status)
    AND (p_date_from IS NULL OR vr.violation_date >= p_date_from)
    AND (p_date_to IS NULL OR vr.violation_date <= p_date_to)
    AND (
      p_search_employee IS NULL
      OR reported_emp.display_name ILIKE '%' || p_search_employee || '%'
      OR reporter_emp.display_name ILIKE '%' || p_search_employee || '%'
    )
  ORDER BY
    CASE
      WHEN vr.status = 'pending_approval' THEN 1
      WHEN vr.status = 'collecting_responses' THEN 2
      WHEN vr.status = 'expired' THEN 3
      WHEN vr.status = 'approved' THEN 4
      WHEN vr.status = 'rejected' THEN 5
      ELSE 6
    END,
    vr.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_violation_reports_for_management TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_violation_reports_for_management TO anon;
