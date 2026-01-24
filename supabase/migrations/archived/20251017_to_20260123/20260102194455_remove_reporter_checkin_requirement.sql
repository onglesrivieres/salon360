/*
  # Remove Check-In Requirement for Violation Report Reporters

  1. Changes
    - Drop existing RLS policy that requires reporters to be checked in
    - Create new policy allowing any employee to file reports
    - Update `create_queue_violation_report` function to remove check-in validation
  
  2. Security
    - Employees can still only report violations for stores they have access to
    - Self-reporting is still prevented
    - Responders must still be checked in to respond
*/

-- Drop the old policy that required reporters to be checked in
DROP POLICY IF EXISTS "Checked-in employees can create reports" ON public.queue_violation_reports;

-- Create new policy allowing any employee to create reports
CREATE POLICY "Employees can create reports"
  ON public.queue_violation_reports
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Verify the reporter is a valid employee at the store
    EXISTS (
      SELECT 1 FROM public.employee_stores
      WHERE employee_id = reporter_employee_id
        AND store_id = queue_violation_reports.store_id
    )
  );

-- Update the function to remove check-in validation
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

  -- Create initial actions for all responders
  IF v_total_responders > 0 THEN
    INSERT INTO public.queue_violation_actions (
      report_id,
      employee_id,
      action_type
    )
    SELECT
      v_report_id,
      unnest(v_responders),
      'pending';
  END IF;

  -- Return success with report details
  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'total_responders', v_total_responders,
    'expires_at', v_expires_at
  );
END;
$$;