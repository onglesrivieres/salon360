/*
  # Add Auto-Approval Run Monitoring

  ## Overview
  Creates a monitoring table to track when the auto-approval function runs and its results.
  This helps diagnose issues when auto-approval isn't working as expected.

  ## Tables Created

  1. `auto_approval_runs`
     - `id` (uuid, primary key) - Unique identifier
     - `executed_at` (timestamptz) - When the function ran
     - `tickets_approved` (integer) - Number of tickets auto-approved
     - `stores_processed` (uuid[]) - List of stores that had tickets processed
     - `result` (jsonb) - Full result from the function
     - `source` (text) - Where the call came from (edge_function, manual, pg_cron)
     - `duration_ms` (integer) - How long the execution took
     - `error_message` (text) - Error message if failed

  ## Security
  - RLS enabled
  - Only managers, admins, and owners can view the logs
*/

-- Create monitoring table for auto-approval runs
CREATE TABLE IF NOT EXISTS public.auto_approval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  tickets_approved integer NOT NULL DEFAULT 0,
  stores_processed uuid[] DEFAULT ARRAY[]::uuid[],
  result jsonb,
  source text NOT NULL DEFAULT 'unknown',
  duration_ms integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for querying recent runs
CREATE INDEX IF NOT EXISTS idx_auto_approval_runs_executed_at 
  ON public.auto_approval_runs (executed_at DESC);

-- Enable RLS
ALTER TABLE public.auto_approval_runs ENABLE ROW LEVEL SECURITY;

-- RLS policy - only managers/admins/owners can view
CREATE POLICY "Managers and above can view auto-approval runs"
  ON public.auto_approval_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = auth.uid()
      AND (
        'Manager' = ANY(e.role) OR 
        'Admin' = ANY(e.role) OR 
        'Owner' = ANY(e.role)
      )
    )
  );

-- Allow anon to insert (for edge function calls)
CREATE POLICY "Edge function can insert auto-approval runs"
  ON public.auto_approval_runs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated to insert (for manual triggers)
CREATE POLICY "Authenticated users can insert auto-approval runs"
  ON public.auto_approval_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to run auto-approval with monitoring
CREATE OR REPLACE FUNCTION public.auto_approve_with_monitoring(p_source text DEFAULT 'unknown')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_start_time timestamptz;
  v_result json;
  v_duration_ms integer;
  v_error_message text;
BEGIN
  v_start_time := clock_timestamp();
  
  BEGIN
    -- Run the auto-approval function
    SELECT public.auto_approve_expired_tickets() INTO v_result;
    
    v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::integer;
    
    -- Log the run
    INSERT INTO public.auto_approval_runs (
      executed_at,
      tickets_approved,
      stores_processed,
      result,
      source,
      duration_ms
    ) VALUES (
      now(),
      COALESCE((v_result->>'count')::integer, 0),
      CASE 
        WHEN v_result->'stores_processed' IS NOT NULL 
        THEN ARRAY(SELECT jsonb_array_elements_text(v_result->'stores_processed')::uuid)
        ELSE ARRAY[]::uuid[]
      END,
      v_result::jsonb,
      p_source,
      v_duration_ms
    );
    
  EXCEPTION WHEN OTHERS THEN
    v_error_message := SQLERRM;
    v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::integer;
    
    -- Log the error
    INSERT INTO public.auto_approval_runs (
      executed_at,
      tickets_approved,
      result,
      source,
      duration_ms,
      error_message
    ) VALUES (
      now(),
      0,
      json_build_object('success', false, 'error', v_error_message)::jsonb,
      p_source,
      v_duration_ms,
      v_error_message
    );
    
    v_result := json_build_object(
      'success', false,
      'error', v_error_message
    );
  END;
  
  RETURN v_result;
END;
$$;

COMMENT ON TABLE public.auto_approval_runs IS 
'Monitoring table that tracks each execution of the auto-approval function. Use this to diagnose issues with auto-approval not running or not processing expected tickets.';

COMMENT ON FUNCTION public.auto_approve_with_monitoring(text) IS 
'Wrapper function that runs auto_approve_expired_tickets and logs the execution to auto_approval_runs table. Pass source parameter to identify caller (edge_function, manual, pg_cron).';
