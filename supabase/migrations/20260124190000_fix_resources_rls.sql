-- Fix RLS policies for resources table
-- The app uses PIN-based authentication (not Supabase Auth), so anon role must be included

-- Drop existing policies (they only have 'authenticated' role)
DROP POLICY IF EXISTS "resources_select" ON resources;
DROP POLICY IF EXISTS "resources_insert" ON resources;
DROP POLICY IF EXISTS "resources_update" ON resources;
DROP POLICY IF EXISTS "resources_delete" ON resources;

-- Recreate with anon + authenticated access (required for PIN-based auth)
CREATE POLICY "resources_select" ON resources
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "resources_insert" ON resources
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "resources_update" ON resources
  FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "resources_delete" ON resources
  FOR DELETE TO anon, authenticated USING (true);
