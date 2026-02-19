/*
  # Resource Visibility Targeting

  ## Overview
  Adds three nullable array columns to `resources` for fine-grained visibility control.
  NULL = visible to all (default). Non-null = restricted to listed values.
  AND logic: employee must match ALL non-null constraints.

  ## Changes

  ### Columns on `resources`
  - `visible_store_ids` uuid[] — restrict by employee store assignment
  - `visible_roles` text[] — restrict by employee role
  - `visible_employee_ids` uuid[] — restrict to specific individuals

  ### Functions
  - `get_unread_resources_count` — updated with visibility filtering
  - `get_unread_resources_count_by_tab` — updated with visibility filtering

  ## Security
  - Existing RLS policies on `resources` unchanged (permissive for anon/authenticated)
  - Visibility enforced at application level + RPC level for badge counts

  ## Notes
  - Existing resources get NULL (no restriction) — fully backwards-compatible
  - Admin/Owner/Manager bypass visibility at application level
*/

-- ============================================================================
-- COLUMNS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resources'
      AND column_name = 'visible_store_ids'
  ) THEN
    ALTER TABLE public.resources ADD COLUMN visible_store_ids uuid[] DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resources'
      AND column_name = 'visible_roles'
  ) THEN
    ALTER TABLE public.resources ADD COLUMN visible_roles text[] DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resources'
      AND column_name = 'visible_employee_ids'
  ) THEN
    ALTER TABLE public.resources ADD COLUMN visible_employee_ids uuid[] DEFAULT NULL;
  END IF;
END $$;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Total unread resources count for sidebar badge (with visibility filtering)
CREATE OR REPLACE FUNCTION public.get_unread_resources_count(
  p_employee_id UUID,
  p_store_id UUID
)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
  v_employee_roles text[];
  v_employee_store_ids uuid[];
BEGIN
  -- Fetch employee's roles
  SELECT role INTO v_employee_roles
  FROM public.employees
  WHERE id = p_employee_id;

  -- Fetch employee's assigned store IDs
  SELECT ARRAY_AGG(es.store_id) INTO v_employee_store_ids
  FROM public.employee_stores es
  WHERE es.employee_id = p_employee_id;

  -- If employee not found, return 0
  IF v_employee_roles IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.resources r
  WHERE r.store_id = p_store_id
    AND r.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.resource_read_status rs
      WHERE rs.resource_id = r.id
        AND rs.employee_id = p_employee_id
    )
    -- Visibility filters (NULL = no restriction)
    AND (r.visible_store_ids IS NULL OR r.visible_store_ids && COALESCE(v_employee_store_ids, ARRAY[]::uuid[]))
    AND (r.visible_roles IS NULL OR r.visible_roles && v_employee_roles)
    AND (r.visible_employee_ids IS NULL OR p_employee_id = ANY(r.visible_employee_ids));

  RETURN v_count;
END;
$$;

-- Per-tab unread counts for tab badges (with visibility filtering)
CREATE OR REPLACE FUNCTION public.get_unread_resources_count_by_tab(
  p_employee_id UUID,
  p_store_id UUID
)
RETURNS TABLE(tab_slug TEXT, unread_count INTEGER)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_employee_roles text[];
  v_employee_store_ids uuid[];
BEGIN
  -- Fetch employee's roles
  SELECT role INTO v_employee_roles
  FROM public.employees
  WHERE id = p_employee_id;

  -- Fetch employee's assigned store IDs
  SELECT ARRAY_AGG(es.store_id) INTO v_employee_store_ids
  FROM public.employee_stores es
  WHERE es.employee_id = p_employee_id;

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
    -- Visibility filters (NULL = no restriction)
    AND (r.visible_store_ids IS NULL OR r.visible_store_ids && COALESCE(v_employee_store_ids, ARRAY[]::uuid[]))
    AND (r.visible_roles IS NULL OR r.visible_roles && v_employee_roles)
    AND (r.visible_employee_ids IS NULL OR p_employee_id = ANY(r.visible_employee_ids))
  GROUP BY r.category;
END;
$$;

-- Grants (already granted, but re-state for clarity)
GRANT EXECUTE ON FUNCTION public.get_unread_resources_count(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_resources_count_by_tab(UUID, UUID) TO anon, authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
