/*
  # Update Calculate Average Duration with Fallback Logic

  1. Purpose
    - Enhances calculate_service_average_duration to use ticket-level timestamps as fallback
    - Estimates service duration from ticket time divided by service count
    - Provides better results for historical data without precise timing

  2. Changes
    - First attempts to use precise ticket_item timestamps (started_at/completed_at)
    - Falls back to ticket-level timestamps (opened_at/closed_at) for estimates
    - Returns data quality indicator: "precise", "estimated", or "mixed"
    - Maintains 5-sample minimum and outlier filtering

  3. Business Logic
    - Precise: Uses ticket_item.started_at and completed_at
    - Estimated: Uses ticket.opened_at to closed_at, divided by service count on ticket
    - Mixed: Combines both precise and estimated data when needed
    - Still filters outliers (1-300 minute range)

  4. Return Format
    - average_duration: integer (minutes) or NULL
    - sample_count: integer (total samples used)
    - data_quality: "precise", "estimated", or "mixed"
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
  v_precise_count integer;
  v_estimated_count integer;
  v_data_quality text;
BEGIN
  -- Calculate durations using a CTE that combines precise and estimated data
  WITH service_durations AS (
    -- Get precise durations from ticket_items with both timestamps
    SELECT 
      EXTRACT(EPOCH FROM (ti.completed_at - ti.started_at)) / 60 AS duration_minutes,
      'precise' AS source_type
    FROM public.ticket_items ti
    WHERE 
      ti.store_service_id = p_store_service_id
      AND ti.started_at IS NOT NULL
      AND ti.completed_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (ti.completed_at - ti.started_at)) / 60 BETWEEN 1 AND 300
    
    UNION ALL
    
    -- Get estimated durations from ticket-level timestamps
    -- Divide total ticket duration by number of services on the ticket
    SELECT 
      (EXTRACT(EPOCH FROM (st.closed_at - st.opened_at)) / 60) / 
        NULLIF((SELECT COUNT(*) FROM public.ticket_items ti2 WHERE ti2.sale_ticket_id = st.id), 0) AS duration_minutes,
      'estimated' AS source_type
    FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE 
      ti.store_service_id = p_store_service_id
      AND ti.started_at IS NULL  -- Only use as fallback when precise timing is missing
      AND st.opened_at IS NOT NULL
      AND st.closed_at IS NOT NULL
      -- Filter outliers after division
      AND (EXTRACT(EPOCH FROM (st.closed_at - st.opened_at)) / 60) / 
          NULLIF((SELECT COUNT(*) FROM public.ticket_items ti2 WHERE ti2.sale_ticket_id = st.id), 0) BETWEEN 1 AND 300
  )
  SELECT 
    AVG(duration_minutes)::numeric,
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE source_type = 'precise')::integer,
    COUNT(*) FILTER (WHERE source_type = 'estimated')::integer
  INTO v_avg_duration, v_sample_count, v_precise_count, v_estimated_count
  FROM service_durations;

  -- Determine data quality
  IF v_precise_count > 0 AND v_estimated_count = 0 THEN
    v_data_quality := 'precise';
  ELSIF v_precise_count = 0 AND v_estimated_count > 0 THEN
    v_data_quality := 'estimated';
  ELSIF v_precise_count > 0 AND v_estimated_count > 0 THEN
    v_data_quality := 'mixed';
  ELSE
    v_data_quality := 'no_data';
  END IF;

  -- Return NULL for average if we have fewer than 5 samples
  IF v_sample_count < 5 THEN
    v_result := jsonb_build_object(
      'average_duration', NULL,
      'sample_count', v_sample_count,
      'data_quality', v_data_quality
    );
  ELSE
    v_result := jsonb_build_object(
      'average_duration', ROUND(v_avg_duration)::integer,
      'sample_count', v_sample_count,
      'data_quality', v_data_quality
    );
  END IF;

  RETURN v_result;
END;
$$;
