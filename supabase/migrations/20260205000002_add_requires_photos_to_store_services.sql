-- Add requires_photos flag to store_services
-- When enabled, new tickets with this service require at least 2 photos and notes

ALTER TABLE public.store_services ADD COLUMN IF NOT EXISTS requires_photos boolean NOT NULL DEFAULT false;

-- Update get_services_by_popularity to include requires_photos
-- Must DROP first because return type is changing (cannot use CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.get_services_by_popularity(uuid, boolean);

CREATE FUNCTION public.get_services_by_popularity(p_store_id uuid, p_include_all boolean DEFAULT false)
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
  usage_count numeric,
  requires_photos boolean
)
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
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
    COALESCE(su.total_usage, 0) as usage_count,
    ss.requires_photos as requires_photos
  FROM public.store_services ss
  LEFT JOIN service_usage su ON ss.id = su.store_service_id
  WHERE ss.store_id = p_store_id
    AND (
      p_include_all = true
      OR (ss.active = true AND COALESCE(ss.archived, false) = false)
    )
  ORDER BY
    COALESCE(su.total_usage, 0) DESC,
    ss.code ASC;
END;
$$;
