/*
  # Fix inventory_items name uniqueness constraint

  ## Overview
  Replaces the global UNIQUE(name) constraint with two partial unique indexes:
  one for top-level items (standalone/master) and one for sub-items per parent.
  This allows sub-items to share names with their parent master item while still
  preventing true duplicates.

  ## Changes

  ### Constraints
  - Drop `inventory_items_unique_name` (global UNIQUE(name))
  - Add partial unique index for top-level items: UNIQUE(name) WHERE parent_id IS NULL
  - Add partial unique index for sub-items per parent: UNIQUE(name, parent_id) WHERE parent_id IS NOT NULL

  ## Notes
  - Sub-items can now have the same name as their parent (different constraint scopes)
  - Duplicate names among top-level items are still prevented
  - Duplicate sibling names under the same parent are still prevented
*/

-- ============================================================================
-- DROP OLD CONSTRAINT
-- ============================================================================

ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_unique_name;

-- ============================================================================
-- NEW PARTIAL UNIQUE INDEXES
-- ============================================================================

-- Top-level items (standalone + master): unique name globally among top-level
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_unique_name_top_level
  ON public.inventory_items(name)
  WHERE parent_id IS NULL;

-- Sub-items: unique (name, parent_id) among children of the same parent
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_unique_name_per_parent
  ON public.inventory_items(name, parent_id)
  WHERE parent_id IS NOT NULL;

-- ============================================================================
-- NOTIFY POSTGREST
-- ============================================================================

NOTIFY pgrst, 'reload schema';
