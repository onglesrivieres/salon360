/*
  # Update get_services_by_popularity for Store-Independent Architecture

  1. Overview
     - Updates the function to work with the new store_services schema
     - Removes dependency on global services table
     - Queries directly from store_services table

  2. Changes
     - Remove JOIN to services table (no longer needed)
     - Return direct fields from store_services: code, name, category, price, duration_min
     - Remove COALESCE logic (no more overrides, just direct values)
     - Update usage count to use store_service_id from ticket_items

  3. Return Fields
     - id: store_services.id
     - store_service_id: store_services.id (for compatibility)
     - code: direct from store_services
     - name: direct from store_services
     - category: direct from store_services
     - price: direct from store_services
     - duration_min: direct from store_services
     - active: direct from store_services
     - archived: direct from store_services
     - usage_count: calculated from ticket_items
*/

-- Drop and recreate function with new signature
DROP FUNCTION IF EXISTS public.get_services_by_popularity(uuid);

CREATE OR REPLACE FUNCTION public.get_services_by_popularity(
  p_store_id uuid
)
RETURNS TABLE (
  id uuid,
  store_service_id uuid,
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
COMMENT ON FUNCTION public.get_services_by_popularity(uuid) IS 'Returns store-specific services sorted by popularity (usage count) within the specified store. Services are fully independent per store. Requires valid store_id parameter.';
