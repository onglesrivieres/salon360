-- Resources table for SOP, Employee Manual, Training, Policies, Rules, etc.
-- This table stores knowledge/reference items that employees can access

-- Create the resources table
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('sop', 'employee_manual', 'training', 'policy', 'rules')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  link_url TEXT,
  thumbnail_url TEXT,
  thumbnail_source VARCHAR(20) DEFAULT 'none' CHECK (thumbnail_source IN ('auto', 'manual', 'none')),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES employees(id),
  updated_by UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries by store and category
CREATE INDEX IF NOT EXISTS idx_resources_store_category
  ON resources(store_id, category);

-- Create index for active resources
CREATE INDEX IF NOT EXISTS idx_resources_active
  ON resources(store_id, is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- RLS policies: All authenticated users can read
CREATE POLICY "resources_select" ON resources
  FOR SELECT TO authenticated USING (true);

-- RLS policies: Authenticated users can insert (app-level permission checks handle role validation)
CREATE POLICY "resources_insert" ON resources
  FOR INSERT TO authenticated WITH CHECK (true);

-- RLS policies: Authenticated users can update (app-level permission checks handle role validation)
CREATE POLICY "resources_update" ON resources
  FOR UPDATE TO authenticated USING (true);

-- RLS policies: Authenticated users can delete (app-level permission checks handle role validation)
CREATE POLICY "resources_delete" ON resources
  FOR DELETE TO authenticated USING (true);

-- Add comment to table
COMMENT ON TABLE resources IS 'Stores knowledge base items like SOPs, manuals, training materials, policies, and rules';
COMMENT ON COLUMN resources.category IS 'Type of resource: sop, employee_manual, training, policy, rules';
COMMENT ON COLUMN resources.thumbnail_source IS 'How the thumbnail was obtained: auto (from link), manual (user provided), none';
