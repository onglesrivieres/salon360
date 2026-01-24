/*
  # Fix Violation Report Date Timezone to EST

  1. Problem
    - Violation reports created on January 3rd EST show as January 2nd
    - Root cause: Using CURRENT_DATE which returns UTC date instead of EST date
    
  2. Solution
    - Update create_queue_violation_report function to use EST timezone
    - Change: CURRENT_DATE → (now() AT TIME ZONE 'America/New_York')::date
    
  3. Impact
    - All new violation reports will correctly use EST date
    - Existing reports are not affected (historical data preserved)
*/

CREATE OR REPLACE FUNCTION public.create_queue_violation_report(
  p_store_id uuid,
  p_employee_id uuid,
  p_violation_type text,
  p_description text,
  p_reporter_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_violation_id uuid;
  v_violation_date date;
  v_required_responders jsonb;
  v_working_employees jsonb;
BEGIN
  -- Get current date in EST timezone
  v_violation_date := (now() AT TIME ZONE 'America/New_York')::date;
  
  -- Get all employees working today (checked in or scheduled)
  v_working_employees := public.get_employees_working_today(p_store_id);
  
  -- Build required_responders from working employees
  v_required_responders := (
    SELECT jsonb_agg(
      jsonb_build_object(
        'employee_id', (value->>'employee_id')::uuid,
        'employee_name', value->>'employee_name',
        'has_responded', false
      )
    )
    FROM jsonb_array_elements(v_working_employees)
    WHERE (value->>'employee_id')::uuid != p_reporter_id
  );

  -- Create the violation report
  INSERT INTO public.queue_violation_reports (
    store_id,
    employee_id,
    violation_type,
    violation_date,
    description,
    reporter_id,
    required_responders,
    status
  )
  VALUES (
    p_store_id,
    p_employee_id,
    p_violation_type,
    v_violation_date,
    p_description,
    p_reporter_id,
    COALESCE(v_required_responders, '[]'::jsonb),
    'pending'
  )
  RETURNING id INTO v_violation_id;

  RETURN jsonb_build_object(
    'success', true,
    'violation_id', v_violation_id,
    'violation_date', v_violation_date
  );
END;
$$;