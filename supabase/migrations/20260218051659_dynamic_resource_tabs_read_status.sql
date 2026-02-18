/*
  # Dynamic Resource Tabs + Read Status Tracking

  ## Overview
  Replaces hardcoded resource tab CHECK constraints with a dynamic `resource_tabs` table,
  and adds `resource_read_status` table for per-employee unread tracking.

  ## Changes

  ### Tables
  - `resource_tabs` - Dynamic tab definitions per store (name, slug, icon, order)
  - `resource_read_status` - Tracks which resources each employee has read

  ### Constraint Changes
  - DROP CHECK on `resources.category` (was hardcoded to 5 values)
  - DROP CHECK on `resource_categories.tab` (was hardcoded to 5 values)

  ### Functions
  - `get_unread_resources_count` - Total unread count for sidebar badge
  - `get_unread_resources_count_by_tab` - Per-tab unread counts for tab badges

  ### Seed Data
  - Seeds 'sop' and 'employee_manual' tabs for stores that have existing resources

  ## Security
  - RLS enabled on both new tables with permissive policies (anon + authenticated)
  - Same pattern as existing resources table (PIN-based auth uses anon role)
*/

-- ============================================================================
-- TABLE: resource_tabs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.resource_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'FileText',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT resource_tabs_unique_slug UNIQUE (store_id, slug),
  CONSTRAINT resource_tabs_name_not_empty CHECK (name <> ''),
  CONSTRAINT resource_tabs_slug_not_empty CHECK (slug <> '')
);

CREATE INDEX IF NOT EXISTS idx_resource_tabs_store
  ON public.resource_tabs(store_id) WHERE is_active = true;

-- ============================================================================
-- TABLE: resource_read_status
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.resource_read_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT resource_read_status_unique UNIQUE (employee_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_read_status_employee_store
  ON public.resource_read_status(employee_id, store_id);

-- ============================================================================
-- DROP CHECK CONSTRAINTS
-- ============================================================================

-- Drop the hardcoded category CHECK on resources table
ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_category_check;

-- Drop the hardcoded tab CHECK on resource_categories table
ALTER TABLE public.resource_categories DROP CONSTRAINT IF EXISTS resource_categories_tab_check;

-- ============================================================================
-- SEED EXISTING TABS
-- ============================================================================

-- Seed 'sop' tab for stores that have SOP resources
INSERT INTO public.resource_tabs (store_id, name, slug, icon_name, display_order)
SELECT DISTINCT store_id, 'Standard Operating Procedures', 'sop', 'FileText', 0
FROM public.resources
WHERE category = 'sop' AND is_active = true
ON CONFLICT (store_id, slug) DO NOTHING;

-- Seed 'employee_manual' tab for stores that have employee manual resources
INSERT INTO public.resource_tabs (store_id, name, slug, icon_name, display_order)
SELECT DISTINCT store_id, 'Employee Manual', 'employee_manual', 'BookOpen', 1
FROM public.resources
WHERE category = 'employee_manual' AND is_active = true
ON CONFLICT (store_id, slug) DO NOTHING;

-- Also seed tabs for stores that have resource_categories but no resources yet
INSERT INTO public.resource_tabs (store_id, name, slug, icon_name, display_order)
SELECT DISTINCT store_id, 'Standard Operating Procedures', 'sop', 'FileText', 0
FROM public.resource_categories
WHERE tab = 'sop' AND is_active = true
ON CONFLICT (store_id, slug) DO NOTHING;

INSERT INTO public.resource_tabs (store_id, name, slug, icon_name, display_order)
SELECT DISTINCT store_id, 'Employee Manual', 'employee_manual', 'BookOpen', 1
FROM public.resource_categories
WHERE tab = 'employee_manual' AND is_active = true
ON CONFLICT (store_id, slug) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY: resource_tabs
-- ============================================================================

ALTER TABLE public.resource_tabs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resource_tabs_select" ON public.resource_tabs;
CREATE POLICY "resource_tabs_select"
  ON public.resource_tabs
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "resource_tabs_insert" ON public.resource_tabs;
CREATE POLICY "resource_tabs_insert"
  ON public.resource_tabs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "resource_tabs_update" ON public.resource_tabs;
CREATE POLICY "resource_tabs_update"
  ON public.resource_tabs
  FOR UPDATE
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "resource_tabs_delete" ON public.resource_tabs;
CREATE POLICY "resource_tabs_delete"
  ON public.resource_tabs
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- ROW LEVEL SECURITY: resource_read_status
-- ============================================================================

ALTER TABLE public.resource_read_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resource_read_status_select" ON public.resource_read_status;
CREATE POLICY "resource_read_status_select"
  ON public.resource_read_status
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "resource_read_status_insert" ON public.resource_read_status;
CREATE POLICY "resource_read_status_insert"
  ON public.resource_read_status
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "resource_read_status_update" ON public.resource_read_status;
CREATE POLICY "resource_read_status_update"
  ON public.resource_read_status
  FOR UPDATE
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "resource_read_status_delete" ON public.resource_read_status;
CREATE POLICY "resource_read_status_delete"
  ON public.resource_read_status
  FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_tabs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resource_read_status TO anon, authenticated;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Total unread resources count for sidebar badge
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
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.resources r
  WHERE r.store_id = p_store_id
    AND r.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.resource_read_status rs
      WHERE rs.resource_id = r.id
        AND rs.employee_id = p_employee_id
    );

  RETURN v_count;
END;
$$;

-- Per-tab unread counts for tab badges
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
    r.category AS tab_slug,
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

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.get_unread_resources_count(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_resources_count_by_tab(UUID, UUID) TO anon, authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
