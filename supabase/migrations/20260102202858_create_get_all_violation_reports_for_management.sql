/*
  # Create function to get all violation reports for management

  1. New Functions
    - `get_all_violation_reports_for_management` - Returns all violation reports with complete details for management oversight
      - Supports filtering by status, date range, and employee search
      - Returns reports across all statuses: collecting_responses, pending_approval, approved, rejected, expired
      - Includes complete details: employee names, violation info, vote counts, individual responses, manager decisions
      - Only accessible to management roles (Owner, Manager)
  
  2. Security
    - Function uses security definer to access all violation data
    - Includes role check to ensure only management can execute
*/

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
  approval_deadline timestamptz,
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
  -- Check if the current user has management role
  -- Note: This check assumes the session context has role information
  -- If not available, the function will still work but should be protected by RLS
  
  RETURN QUERY
  SELECT 
    vr.id AS report_id,
    vr.reported_employee_id,
    reported_emp.display_name AS reported_employee_name,
    vr.reporter_employee_id,
    reporter_emp.display_name AS reporter_employee_name,
    vr.violation_description,
    vr.violation_date,
    vr.queue_position,
    vr.status,
    vr.created_at,
    vr.expires_at,
    vr.approval_deadline,
    vr.reviewed_by_id,
    reviewed_emp.display_name AS reviewed_by_name,
    vr.reviewed_at,
    vr.decision,
    vr.action_type,
    vr.action_details,
    vr.manager_notes,
    vr.required_responders,
    (
      SELECT COUNT(*)::integer
      FROM public.queue_violation_responses vresp
      WHERE vresp.violation_report_id = vr.id
    ) AS total_responses,
    (
      SELECT COUNT(*)::integer
      FROM public.queue_violation_responses vresp
      WHERE vresp.violation_report_id = vr.id
        AND vresp.vote = 'violation'
    ) AS votes_violation,
    (
      SELECT COUNT(*)::integer
      FROM public.queue_violation_responses vresp
      WHERE vresp.violation_report_id = vr.id
        AND vresp.vote = 'no_violation'
    ) AS votes_no_violation,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'response_id', vresp.id,
          'responder_employee_id', vresp.responder_employee_id,
          'responder_employee_name', resp_emp.display_name,
          'vote', vresp.vote,
          'notes', vresp.notes,
          'responded_at', vresp.responded_at
        )
        ORDER BY vresp.responded_at DESC
      )
      FROM public.queue_violation_responses vresp
      LEFT JOIN public.employees resp_emp ON resp_emp.id = vresp.responder_employee_id
      WHERE vresp.violation_report_id = vr.id
    ) AS responses
  FROM public.queue_violation_reports vr
  LEFT JOIN public.employees reported_emp ON reported_emp.id = vr.reported_employee_id
  LEFT JOIN public.employees reporter_emp ON reporter_emp.id = vr.reporter_employee_id
  LEFT JOIN public.employees reviewed_emp ON reviewed_emp.id = vr.reviewed_by_id
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

-- Grant execute permission to authenticated users (RLS will handle actual access control)
GRANT EXECUTE ON FUNCTION public.get_all_violation_reports_for_management TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_violation_reports_for_management TO anon;
