/*
  # Fix Auto-Approval Monitoring JSON Type Mismatch

  1. Changes
    - Fix the `auto_approve_with_monitoring` function to properly handle JSON/JSONB type conversion
    - The function was trying to use `jsonb_array_elements_text` on a `json` type
    - Now properly casts to jsonb where needed

  2. Technical Details
    - Drop and recreate function with correct return type
    - Changed v_result type from json to jsonb for consistency
    - Fixed the stores_processed extraction to use proper jsonb functions
*/

-- Drop the existing function to change return type
DROP FUNCTION IF EXISTS public.auto_approve_with_monitoring(text);

CREATE FUNCTION public.auto_approve_with_monitoring(p_source text DEFAULT 'cron')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_time timestamptz;
  v_result jsonb;
  v_duration_ms integer;
  v_error_message text;
BEGIN
  v_start_time := clock_timestamp();

  BEGIN
    -- Run the auto-approval function and cast result to jsonb
    SELECT public.auto_approve_expired_tickets()::jsonb INTO v_result;

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
      v_result,
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
      jsonb_build_object('success', false, 'error', v_error_message),
      p_source,
      v_duration_ms,
      v_error_message
    );

    v_result := jsonb_build_object(
      'success', false,
      'error', v_error_message
    );
  END;

  RETURN v_result;
END;
$$;