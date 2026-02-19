-- Fix get_unread_resources_count_by_tab: cast r.category (VARCHAR(50)) to TEXT
-- to match the declared RETURNS TABLE(tab_slug TEXT, ...) signature.
-- Resolves PostgreSQL 42804 error on Resources page load.

CREATE OR REPLACE FUNCTION public.get_unread_resources_count_by_tab(
  p_employee_id UUID,
  p_store_id UUID
)
RETURNS TABLE(tab_slug TEXT, unread_count INTEGER)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.category::text AS tab_slug,
    COUNT(*)::INTEGER AS unread_count
  FROM public.resources r
  WHERE r.store_id = p_store_id
    AND r.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.resource_read_status rs
      WHERE rs.resource_id = r.id
        AND rs.employee_id = p_employee_id
    )
  GROUP BY r.category;
END;
$$;

NOTIFY pgrst, 'reload schema';
