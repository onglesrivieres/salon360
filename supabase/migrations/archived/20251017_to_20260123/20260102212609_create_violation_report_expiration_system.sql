/*
  # Create Violation Report Expiration System

  ## Summary
  Creates an automated system to expire violation reports after 60 minutes if they haven't
  collected all responses. Expired reports are automatically sent to management for review
  with information about votes collected vs. minimum required.

  ## Changes
  1. New Functions
    - `expire_violation_reports()` - Finds and expires reports older than 60 minutes
    - Updates get_violation_reports_for_approval to include expired reports
  
  2. Cron Job
    - Runs expire_violation_reports() every 5 minutes
  
  ## Security
  - Function uses SECURITY DEFINER with SET search_path for safety
*/

-- Function to expire violation reports after 60 minutes
CREATE OR REPLACE FUNCTION public.expire_violation_reports()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count integer;
  v_expired_reports jsonb;
BEGIN
  -- Find and expire reports that are past their expiration time
  WITH expired AS (
    UPDATE public.queue_violation_reports
    SET status = 'expired'
    WHERE status = 'collecting_responses'
      AND expires_at <= now()
    RETURNING 
      id,
      store_id,
      reported_employee_id,
      violation_description,
      votes_violation_confirmed,
      min_votes_required_snapshot,
      total_responses_received,
      total_responses_required,
      threshold_met,
      insufficient_responders
  )
  SELECT 
    COUNT(*)::integer,
    jsonb_agg(
      jsonb_build_object(
        'report_id', id,
        'store_id', store_id,
        'reported_employee_id', reported_employee_id,
        'votes_received', votes_violation_confirmed,
        'votes_required', min_votes_required_snapshot,
        'threshold_met', threshold_met,
        'insufficient_responders', insufficient_responders
      )
    )
  INTO v_expired_count, v_expired_reports
  FROM expired;

  -- Return summary of expired reports
  RETURN jsonb_build_object(
    'success', true,
    'expired_count', COALESCE(v_expired_count, 0),
    'expired_reports', COALESCE(v_expired_reports, '[]'::jsonb),
    'processed_at', now()
  );
END;
$$;

-- Drop and recreate get_violation_reports_for_approval with new fields
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
  insufficient_responders boolean
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
    vr.insufficient_responders
  FROM public.queue_violation_reports vr
  JOIN public.employees reported ON reported.id = vr.reported_employee_id
  JOIN public.employees reporter ON reporter.id = vr.reporter_employee_id
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

-- Create a cron job to run expire_violation_reports every 5 minutes
-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing cron job if it exists (in case we're re-running migration)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-violation-reports') 
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'expire-violation-reports'
  );
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignore if cron job doesn't exist
END $$;

-- Schedule the expiration job to run every 5 minutes
SELECT cron.schedule(
  'expire-violation-reports',
  '*/5 * * * *', -- Every 5 minutes
  $$SELECT public.expire_violation_reports()$$
);

-- Add comment explaining the cron job
COMMENT ON FUNCTION public.expire_violation_reports IS 'Automatically expires violation reports that are older than 60 minutes and still collecting responses. Runs every 5 minutes via cron job.';
