/*
  # Add Function to Calculate Average Service Duration

  1. New Functions
    - `calculate_service_average_duration(p_store_service_id uuid)`
      - Calculates average duration for a service based on completed ticket items
      - Requires minimum 5 completed services to return an average
      - Excludes outliers (services under 1 minute or over 300 minutes)
      - Returns JSON with average_duration (integer minutes) and sample_count (integer)

  2. Security
    - Function is SECURITY DEFINER to allow access to ticket_items data
    - Sets search_path for security
    - Accessible by anonymous users for service management

  3. Logic
    - Only includes ticket items with both started_at and completed_at timestamps
    - Calculates duration in minutes from the timestamp difference
    - Filters out extreme outliers to ensure realistic averages
    - Returns NULL for average_duration if fewer than 5 samples exist
*/

CREATE OR REPLACE FUNCTION public.calculate_service_average_duration(p_store_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_avg_duration numeric;
  v_sample_count integer;
BEGIN
  -- Calculate average duration and count of completed services
  SELECT 
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)::numeric,
    COUNT(*)::integer
  INTO v_avg_duration, v_sample_count
  FROM public.ticket_items
  WHERE 
    store_service_id = p_store_service_id
    AND started_at IS NOT NULL
    AND completed_at IS NOT NULL
    -- Exclude outliers: services under 1 minute or over 300 minutes (5 hours)
    AND EXTRACT(EPOCH FROM (completed_at - started_at)) / 60 BETWEEN 1 AND 300;

  -- Return NULL for average if we have fewer than 5 samples
  IF v_sample_count < 5 THEN
    v_result := jsonb_build_object(
      'average_duration', NULL,
      'sample_count', v_sample_count
    );
  ELSE
    v_result := jsonb_build_object(
      'average_duration', ROUND(v_avg_duration)::integer,
      'sample_count', v_sample_count
    );
  END IF;

  RETURN v_result;
END;
$$;