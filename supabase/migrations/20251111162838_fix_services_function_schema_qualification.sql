/*
  # Fix get_services_by_popularity Function Schema Qualification

  1. Overview
     - Adds explicit schema qualifications (public.) to all table references
     - Fixes the "relation 'ticket_items' does not exist" error
     - Makes function compatible with empty search_path security setting

  2. Changes
     - Fully qualify all table names: ticket_items -> public.ticket_items
     - Fully qualify: sale_tickets -> public.sale_tickets
     - Fully qualify: store_services -> public.store_services
     - Fully qualify: services -> public.services

  3. Security
     - Maintains security by working with empty search_path
     - Prevents search_path manipulation attacks
*/

-- Recreate function with fully qualified table names
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
      ti.service_id,
      SUM(ti.qty) as total_usage
    FROM public.ticket_items ti
    JOIN public.sale_tickets st ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
    GROUP BY ti.service_id
  )
  SELECT
    s.id as id,
    ss.id as store_service_id,
    ss.service_id as service_id,
    s.code as code,
    s.name as name,
    COALESCE(ss.price_override, s.base_price) as price,
    COALESCE(ss.duration_override, s.duration_min) as duration_min,
    s.category as category,
    ss.active as active,
    ss.created_at as created_at,
    ss.updated_at as updated_at,
    COALESCE(su.total_usage, 0) as usage_count
  FROM public.store_services ss
  JOIN public.services s ON ss.service_id = s.id
  LEFT JOIN service_usage su ON ss.service_id = su.service_id
  WHERE ss.store_id = p_store_id
    AND ss.active = true
  ORDER BY
    COALESCE(su.total_usage, 0) DESC,
    s.code ASC;
END;
$$;

-- Ensure search_path is set to empty for security
ALTER FUNCTION public.get_services_by_popularity(p_store_id uuid) SET search_path = '';

-- Add function comment
COMMENT ON FUNCTION public.get_services_by_popularity(uuid) IS 'Returns store-specific services sorted by popularity (usage count) within the specified store. Requires valid store_id parameter. All tables are fully qualified for security.';
