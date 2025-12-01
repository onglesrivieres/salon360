/*
  # Fix get_services_by_popularity to Include service_id Field

  1. Overview
     - Adds missing service_id field to function return type
     - Sets service_id as alias of id for backward compatibility
     - Fixes "Service is required" error in ticket creation

  2. Problem
     - TypeScript interface expects service_id field
     - TicketEditor uses service.service_id to filter and select services
     - Current function returns id and store_service_id but not service_id
     - This causes undefined values breaking service selection

  3. Solution
     - Add service_id to RETURNS TABLE signature
     - Return ss.id as service_id in query
     - Maintains backward compatibility with existing code

  4. Impact
     - Fixes service selection buttons in ticket creation
     - Allows proper filtering by employee service capabilities
     - Resolves "Service is required" validation error
*/

-- Drop and recreate function with service_id field
DROP FUNCTION IF EXISTS public.get_services_by_popularity(uuid);

CREATE OR REPLACE FUNCTION public.get_services_by_popularity(
  p_store_id uuid
)
RETURNS TABLE (
  id uuid,
  store_service_id uuid,
  service_id uuid,
  code text,
  name text,
  price numeric,
  duration_min integer,
  category text,
  active boolean,
  archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  usage_count numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate required parameter
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'p_store_id parameter is required';
  END IF;

  RETURN QUERY
  WITH service_usage AS (
    SELECT
      ti.store_service_id,
      SUM(ti.qty) as total_usage
    FROM public.ticket_items ti
    JOIN public.sale_tickets st ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND ti.store_service_id IS NOT NULL
    GROUP BY ti.store_service_id
  )
  SELECT
    ss.id as id,
    ss.id as store_service_id,
    ss.id as service_id,
    ss.code as code,
    ss.name as name,
    ss.price as price,
    ss.duration_min as duration_min,
    ss.category as category,
    ss.active as active,
    COALESCE(ss.archived, false) as archived,
    ss.created_at as created_at,
    ss.updated_at as updated_at,
    COALESCE(su.total_usage, 0) as usage_count
  FROM public.store_services ss
  LEFT JOIN service_usage su ON ss.id = su.store_service_id
  WHERE ss.store_id = p_store_id
    AND ss.active = true
    AND COALESCE(ss.archived, false) = false
  ORDER BY
    COALESCE(su.total_usage, 0) DESC,
    ss.code ASC;
END;
$$;

-- Ensure search_path is set to empty for security
ALTER FUNCTION public.get_services_by_popularity(p_store_id uuid) SET search_path = '';

-- Add function comment
COMMENT ON FUNCTION public.get_services_by_popularity(uuid) IS 'Returns store-specific services sorted by popularity (usage count) within the specified store. Services are fully independent per store. Includes service_id as alias of id for backward compatibility. Requires valid store_id parameter.';
