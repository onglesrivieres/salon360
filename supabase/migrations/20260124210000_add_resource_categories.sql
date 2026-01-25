-- Resource Categories table for organizing resources within each tab
-- This table stores sub-categories like "Opening Procedures", "Closing Procedures" within SOP tab

-- Create the resource_categories table
CREATE TABLE IF NOT EXISTS resource_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  tab VARCHAR(50) NOT NULL CHECK (tab IN ('sop', 'employee_manual', 'training', 'policy', 'rules')),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT resource_categories_name_not_empty CHECK (name <> ''),
  CONSTRAINT resource_categories_unique_name UNIQUE (store_id, tab, name)
);

-- Create index for efficient queries by store and tab
CREATE INDEX IF NOT EXISTS idx_resource_categories_store_tab
  ON resource_categories(store_id, tab);

-- Enable Row Level Security
ALTER TABLE resource_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies: All users can read (anon required for PIN-based auth)
CREATE POLICY "resource_categories_select" ON resource_categories
  FOR SELECT TO anon, authenticated USING (true);

-- RLS policies: Users can insert (app-level permission checks handle role validation)
CREATE POLICY "resource_categories_insert" ON resource_categories
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- RLS policies: Users can update (app-level permission checks handle role validation)
CREATE POLICY "resource_categories_update" ON resource_categories
  FOR UPDATE TO anon, authenticated USING (true);

-- RLS policies: Users can delete (app-level permission checks handle role validation)
CREATE POLICY "resource_categories_delete" ON resource_categories
  FOR DELETE TO anon, authenticated USING (true);

-- Add subcategory column to resources table
ALTER TABLE resources ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT NULL;

-- Create index for efficient queries by subcategory
CREATE INDEX IF NOT EXISTS idx_resources_subcategory
  ON resources(store_id, category, subcategory);

-- Add comments
COMMENT ON TABLE resource_categories IS 'Stores sub-categories for organizing resources within each tab (SOP, Employee Manual, etc.)';
COMMENT ON COLUMN resource_categories.tab IS 'Which tab this category belongs to: sop, employee_manual, training, policy, rules';
COMMENT ON COLUMN resource_categories.color IS 'Color for the category badge/pill';
COMMENT ON COLUMN resources.subcategory IS 'Optional sub-category name for grouping within a tab';
