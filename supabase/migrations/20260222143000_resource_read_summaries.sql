/*
  # Resource Read Summaries RPC

  ## Overview
  Returns per-resource read counts for managers, respecting the 3-way AND
  visibility logic (stores, roles, employees). Single call per page load,
  no N+1 queries.

  ## Returns
  One row per active resource at the given store:
  - resource_id UUID
  - read_count INTEGER — how many targeted employees have read it
  - total_targeted INTEGER — how many employees should see it
  - readers JSONB — array of {employee_id, display_name, read_at}
    (read_at is null for non-readers)

  ## Security
  SECURITY DEFINER — runs with definer privileges for cross-table access.
  Intended to be called only by managers via application-level gating.
*/

CREATE OR REPLACE FUNCTION public.get_resource_read_summaries(
  p_store_id UUID
)
RETURNS TABLE(
  resource_id UUID,
  read_count INTEGER,
  total_targeted INTEGER,
  readers JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
    -- All active employees assigned to this store
    active_employees AS (
      SELECT
        e.id AS employee_id,
        COALESCE(e.display_name, e.legal_name, 'Unknown') AS display_name,
        e.role AS roles
      FROM public.employees e
      INNER JOIN public.employee_stores es ON es.employee_id = e.id
      WHERE es.store_id = p_store_id
        AND e.status = 'Active'
    ),

    -- All store assignments for active employees (needed for visible_store_ids check)
    all_employee_store_links AS (
      SELECT es2.employee_id, es2.store_id
      FROM public.employee_stores es2
      INNER JOIN public.employees e2 ON e2.id = es2.employee_id
      WHERE e2.status = 'Active'
    ),

    -- All active resources at this store
    active_resources AS (
      SELECT
        r.id,
        r.visible_store_ids,
        r.visible_roles,
        r.visible_employee_ids
      FROM public.resources r
      WHERE r.store_id = p_store_id
        AND r.is_active = true
    ),

    -- Cross join resources × employees, then filter by visibility
    targeted AS (
      SELECT
        ar.id AS resource_id,
        ae.employee_id,
        ae.display_name
      FROM active_resources ar
      CROSS JOIN active_employees ae
      WHERE
        -- Store visibility: NULL = all, otherwise employee must have assignment in one of the listed stores
        (
          ar.visible_store_ids IS NULL
          OR EXISTS (
            SELECT 1 FROM all_employee_store_links aesl
            WHERE aesl.employee_id = ae.employee_id
              AND aesl.store_id = ANY(ar.visible_store_ids)
          )
        )
        -- Role visibility: NULL = all, otherwise employee must have an overlapping role
        AND (
          ar.visible_roles IS NULL
          OR ae.roles && ar.visible_roles::text[]
        )
        -- Employee visibility: NULL = all, otherwise employee must be in the list
        AND (
          ar.visible_employee_ids IS NULL
          OR ae.employee_id = ANY(ar.visible_employee_ids)
        )
    ),

    -- Read entries for this store
    read_entries AS (
      SELECT rs.resource_id, rs.employee_id, rs.read_at
      FROM public.resource_read_status rs
      WHERE rs.store_id = p_store_id
    )

  SELECT
    t.resource_id,
    COALESCE(SUM(CASE WHEN re.read_at IS NOT NULL THEN 1 ELSE 0 END), 0)::INTEGER AS read_count,
    COUNT(*)::INTEGER AS total_targeted,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'employee_id', t.employee_id,
          'display_name', t.display_name,
          'read_at', re.read_at
        )
        ORDER BY
          -- Readers first (by read_at DESC), then non-readers alphabetically
          CASE WHEN re.read_at IS NOT NULL THEN 0 ELSE 1 END,
          re.read_at DESC NULLS LAST,
          t.display_name ASC
      ),
      '[]'::jsonb
    ) AS readers
  FROM targeted t
  LEFT JOIN read_entries re
    ON re.resource_id = t.resource_id
    AND re.employee_id = t.employee_id
  GROUP BY t.resource_id;
END;
$$;

-- Grant execute to authenticated users (application-level gating for managers)
GRANT EXECUTE ON FUNCTION public.get_resource_read_summaries(UUID) TO anon, authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
