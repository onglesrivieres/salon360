/*
  # Update Vote Collection with Threshold Logic

  ## Summary
  Updates the submit_violation_response function to:
  - Track "violation confirmed" (YES) votes separately
  - Check if minimum votes threshold is met
  - Update threshold_met flag when minimum YES votes reached
  - Include threshold information in response
  - Still require all responses to be collected before moving to pending_approval

  ## Changes
  - Modified submit_violation_response function to include YES vote counting and threshold checking
  - Updated return value to include votes_violation_confirmed and threshold_met
*/

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
  v_new_yes_votes integer;
  v_threshold_met boolean;
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

  -- Update response count and YES votes count
  UPDATE public.queue_violation_reports
  SET 
    total_responses_received = total_responses_received + 1,
    votes_violation_confirmed = votes_violation_confirmed + CASE WHEN p_response THEN 1 ELSE 0 END
  WHERE id = p_violation_report_id
  RETURNING 
    total_responses_received,
    votes_violation_confirmed
  INTO v_new_total, v_new_yes_votes;

  -- Check if threshold is met
  v_threshold_met := v_new_yes_votes >= v_report.min_votes_required_snapshot;

  -- Update threshold_met flag
  UPDATE public.queue_violation_reports
  SET threshold_met = v_threshold_met
  WHERE id = p_violation_report_id;

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
    'votes_violation_confirmed', v_new_yes_votes,
    'min_votes_required', v_report.min_votes_required_snapshot,
    'threshold_met', v_threshold_met,
    'status', CASE 
      WHEN v_new_total >= v_report.total_responses_required THEN 'pending_approval' 
      ELSE 'collecting_responses' 
    END
  );
END;
$$;
