/*
  # Fix Violation Report Actions Column Error

  1. Changes
    - Remove incorrect INSERT into queue_violation_actions from create_queue_violation_report function
    - The queue_violation_actions table is designed for recording disciplinary actions AFTER manager approval
    - Pending responders are already tracked through get_pending_violation_responses function
  
  2. Rationale
    - The function was trying to use columns 'report_id' and 'employee_id' that don't exist
    - The table has 'violation_report_id' and 'created_by_employee_id' instead
    - The 'pending' action_type is not valid (constraint allows: 'warning', 'queue_removal', 'written_warning', 'suspension', 'none')
    - This table should only be used when managers take action after approval, not during report creation
*/

-- Update the function to remove incorrect INSERT into queue_violation_actions
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

  -- Return success with report details
  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'total_responders', v_total_responders,
    'expires_at', v_expires_at
  );
END;
$$;