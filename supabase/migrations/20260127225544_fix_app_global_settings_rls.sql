/*
  # Fix RLS Policies for app_global_settings

  Replaces the `FOR ALL` policy with explicit policies for each operation
  to ensure UPDATE operations work correctly.

  ## Issue
  The original `FOR ALL` policy wasn't allowing UPDATE operations,
  resulting in PGRST116 error "The result contains 0 rows".

  ## Changes
  - Drops existing broad policies
  - Creates separate policies for SELECT, INSERT, UPDATE, DELETE
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow read access to global settings" ON public.app_global_settings;
DROP POLICY IF EXISTS "Allow write access to global settings" ON public.app_global_settings;

-- SELECT: Allow all users to read
CREATE POLICY "global_settings_select"
  ON public.app_global_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- INSERT: Allow authenticated users
CREATE POLICY "global_settings_insert"
  ON public.app_global_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Allow authenticated users
CREATE POLICY "global_settings_update"
  ON public.app_global_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Allow authenticated users
CREATE POLICY "global_settings_delete"
  ON public.app_global_settings
  FOR DELETE
  TO authenticated
  USING (true);

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
