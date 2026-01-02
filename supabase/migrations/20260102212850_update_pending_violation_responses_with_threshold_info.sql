/*
  # Update Pending Violation Responses with Threshold Information

  ## Summary
  Updates the get_pending_violation_responses function to include threshold information
  for the violation response ribbon, including minimum votes required and current YES vote count.

  ## Changes
  - Updated get_pending_violation_responses to return min_votes_required_snapshot and votes_violation_confirmed
*/

DROP FUNCTION IF EXISTS public.get_pending_violation_responses(uuid, uuid);

CREATE FUNCTION public.get_pending_violation_responses(
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
  created_at timestamptz,
  min_votes_required integer,
  votes_violation_confirmed integer
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
    vr.created_at,
    vr.min_votes_required_snapshot,
    vr.votes_violation_confirmed
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
