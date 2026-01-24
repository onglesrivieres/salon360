/*
  # Fix app_versions RLS Performance Issues

  1. Changes
    - Drop existing RLS policies on app_versions table
    - Recreate policies with optimized auth function calls using (select auth.<function>())
    - This prevents re-evaluation of auth functions for each row, improving performance at scale

  2. Security
    - Maintains same security model: all users can view, only admins can insert/update/delete
    - Optimizes performance by wrapping auth function calls in subqueries
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view versions" ON app_versions;
DROP POLICY IF EXISTS "Admins can insert versions" ON app_versions;
DROP POLICY IF EXISTS "Admins can update versions" ON app_versions;
DROP POLICY IF EXISTS "Admins can delete versions" ON app_versions;

-- Recreate policies with optimized auth function calls
CREATE POLICY "Users can view versions"
  ON app_versions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert versions"
  ON app_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE id = (SELECT auth.uid())
      AND 'Admin' = ANY(role)
    )
  );

CREATE POLICY "Admins can update versions"
  ON app_versions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE id = (SELECT auth.uid())
      AND 'Admin' = ANY(role)
    )
  );

CREATE POLICY "Admins can delete versions"
  ON app_versions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE id = (SELECT auth.uid())
      AND 'Admin' = ANY(role)
    )
  );
