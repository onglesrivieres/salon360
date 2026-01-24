/*
  # Allow Retrieving All Services (Including Inactive/Archived)

  ## Overview
  Modifies get_services_by_popularity to optionally return all services regardless of
  active/archived status, enabling frontend filtering in ServicesPage.

  ## Problem
  - The RPC function only returned active, non-archived services
  - The ServicesPage UI has status filters (all/active/inactive/archived)
  - These filters were useless because inactive/archived services were never returned
  - If services were marked inactive/archived, they completely disappeared from the page

  ## Solution
  - Add optional `p_include_all` parameter (default: false)
  - When false: Returns only active, non-archived services (existing behavior)
  - When true: Returns ALL services regardless of status

  ## Impact
  - Backward compatible: default parameter value preserves existing behavior
  - TicketEditor.tsx continues to work without any changes (uses default false)
  - ServicesPage.tsx will pass p_include_all = true to see all services
*/

-- Drop existing function (with both potential signatures for safety)
DROP FUNCTION IF EXISTS public.get_services_by_popularity(uuid);
DROP FUNCTION IF EXISTS public.get_services_by_popularity(uuid, boolean);

CREATE OR REPLACE FUNCTION public.get_services_by_popularity(
  p_store_id uuid,
  p_include_all boolean DEFAULT false
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
    -- Only apply active/archived filter when p_include_all is false
    AND (
      p_include_all = true
      OR (ss.active = true AND COALESCE(ss.archived, false) = false)
    )
  ORDER BY
    COALESCE(su.total_usage, 0) DESC,
    ss.code ASC;
END;
$$;

-- Ensure search_path is set to empty for security
ALTER FUNCTION public.get_services_by_popularity(uuid, boolean) SET search_path = '';

-- Add function comment
COMMENT ON FUNCTION public.get_services_by_popularity(uuid, boolean) IS
'Returns store-specific services sorted by popularity (usage count) within the specified store.
When p_include_all is false (default), returns only active non-archived services for ticket creation.
When p_include_all is true, returns ALL services for admin management views.
Includes service_id as alias of id for backward compatibility. Requires valid store_id parameter.';
