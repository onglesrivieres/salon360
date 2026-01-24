/*
  # Fix get_all_violation_reports_for_management Column Name Mismatches

  1. Changes
    - Fix all column name references to match actual table schema
    - Add LEFT JOIN to queue_violation_actions to retrieve action data
    - Update response field references (vote → response, notes → response_notes)
    - Fix employee_id references in responses
    - Remove non-existent approval_deadline field
    - Update return type to match corrected schema

  2. Column Corrections
    - queue_position → queue_position_claimed
    - reviewed_by_id → reviewed_by_employee_id
    - decision → manager_decision
    - required_responders → total_responses_required
    - responder_employee_id → employee_id
    - vote → response (boolean: true = violation, false = no_violation)
    - notes → response_notes
    - Join queue_violation_actions for action_type and action_details
*/

-- Drop the existing function first since we're changing the return type
DROP FUNCTION IF EXISTS public.get_all_violation_reports_for_management(uuid, text, date, date, text);

-- Recreate with correct column names
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
  responses jsonb
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
    ) AS responses
  FROM public.queue_violation_reports vr
  LEFT JOIN public.employees reported_emp ON reported_emp.id = vr.reported_employee_id
  LEFT JOIN public.employees reporter_emp ON reporter_emp.id = vr.reporter_employee_id
  LEFT JOIN public.employees reviewed_emp ON reviewed_emp.id = vr.reviewed_by_employee_id
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

-- Grant execute permission to authenticated users and anon
GRANT EXECUTE ON FUNCTION public.get_all_violation_reports_for_management TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_violation_reports_for_management TO anon;
