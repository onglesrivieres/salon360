/*
  # Update Violation Report Creation with Threshold Logic

  ## Summary
  Updates the create_queue_violation_report function to:
  - Read minimum votes required from store settings
  - Calculate and set insufficient_responders flag
  - Set expires_at to 60 minutes (not 24 hours)
  - Store min_votes_required_snapshot for historical reference
  - Return additional information about threshold requirements

  ## Changes
  - Modified create_queue_violation_report function to include threshold logic
  - Updated return value to include min_votes_required and insufficient_responders flag
*/

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
  v_min_votes_required integer;
  v_insufficient_responders boolean;
BEGIN
  -- Get current date in EST
  v_violation_date := CURRENT_DATE;

  -- Set expiration to 60 minutes from now
  v_expires_at := now() + interval '60 minutes';

  -- Validate: reporter and reported employee are different
  IF p_reporter_employee_id = p_reported_employee_id THEN
    RAISE EXCEPTION 'Cannot report yourself for a violation';
  END IF;

  -- Get minimum votes required from store settings
  SELECT violation_min_votes_required INTO v_min_votes_required
  FROM public.stores
  WHERE id = p_store_id;

  -- Default to 3 if not set
  v_min_votes_required := COALESCE(v_min_votes_required, 3);

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

  -- Determine if there are insufficient responders
  v_insufficient_responders := v_total_responders < v_min_votes_required;

  -- Create the violation report with threshold information
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
    expires_at,
    min_votes_required_snapshot,
    insufficient_responders,
    votes_violation_confirmed,
    threshold_met
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
    v_expires_at,
    v_min_votes_required,
    v_insufficient_responders,
    0,
    false
  )
  RETURNING id INTO v_report_id;

  -- Return success with report details
  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'total_responders', v_total_responders,
    'required_responders', COALESCE(v_responders, ARRAY[]::uuid[]),
    'expires_at', v_expires_at,
    'min_votes_required', v_min_votes_required,
    'insufficient_responders', v_insufficient_responders
  );
END;
$$;
