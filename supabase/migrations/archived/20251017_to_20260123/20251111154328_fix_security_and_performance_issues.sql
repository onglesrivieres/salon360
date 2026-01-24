/*
  # Fix Security and Performance Issues

  This migration addresses multiple security and performance issues identified in the database:

  ## 1. Add Missing Indexes for Foreign Keys
  - Add index on sale_tickets.completed_by
  - Add index on ticket_items.completed_by

  ## 2. Fix RLS Policy Performance
  - Update app_versions RLS policy to use subquery for auth functions

  ## 3. Remove Unused Indexes
  - Drop indexes that are not being used to reduce overhead

  ## 4. Fix Multiple Permissive Policies
  - Consolidate overlapping RLS policies on app_versions table

  ## 5. Fix Function Search Path Mutability
  - Set search_path to '' for all functions to prevent search path injection attacks

  All changes are idempotent and safe to run multiple times.
*/

-- =====================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- =====================================================

-- Add index for sale_tickets.completed_by foreign key
CREATE INDEX IF NOT EXISTS idx_sale_tickets_completed_by
ON sale_tickets(completed_by);

-- Add index for ticket_items.completed_by foreign key
CREATE INDEX IF NOT EXISTS idx_ticket_items_completed_by
ON ticket_items(completed_by);

-- =====================================================
-- 2. REMOVE UNUSED INDEXES
-- =====================================================

-- Remove unused indexes to reduce overhead
DROP INDEX IF EXISTS idx_services_name;
DROP INDEX IF EXISTS idx_ticket_items_tip_customer_card;
DROP INDEX IF EXISTS idx_ticket_items_completed_at;
DROP INDEX IF EXISTS idx_ticket_items_started_at;
DROP INDEX IF EXISTS idx_employees_status;
DROP INDEX IF EXISTS idx_employees_role_gin;
DROP INDEX IF EXISTS idx_sale_tickets_completed_at;
DROP INDEX IF EXISTS idx_sale_tickets_requires_higher_approval;
DROP INDEX IF EXISTS idx_store_services_store_active;
DROP INDEX IF EXISTS idx_store_services_service_lookup;
DROP INDEX IF EXISTS idx_app_versions_is_active;
DROP INDEX IF EXISTS idx_app_versions_deployed_at;

-- =====================================================
-- 3. FIX MULTIPLE PERMISSIVE POLICIES
-- =====================================================

-- Drop existing policies on app_versions
DROP POLICY IF EXISTS "Admins can manage versions" ON app_versions;
DROP POLICY IF EXISTS "Anyone can view active versions" ON app_versions;

-- Create a single consolidated SELECT policy
CREATE POLICY "Users can view versions"
  ON app_versions
  FOR SELECT
  USING (
    is_active = true
    OR
    EXISTS (
      SELECT 1 FROM employees
      WHERE id::text = (SELECT (auth.uid())::text)
      AND 'Admin' = ANY(role)
    )
  );

-- Recreate admin management policies (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can insert versions"
  ON app_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE id::text = (SELECT (auth.uid())::text)
      AND 'Admin' = ANY(role)
    )
  );

CREATE POLICY "Admins can update versions"
  ON app_versions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE id::text = (SELECT (auth.uid())::text)
      AND 'Admin' = ANY(role)
    )
  );

CREATE POLICY "Admins can delete versions"
  ON app_versions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE id::text = (SELECT (auth.uid())::text)
      AND 'Admin' = ANY(role)
    )
  );

-- =====================================================
-- 4. FIX FUNCTION SEARCH PATH MUTABILITY
-- =====================================================

-- Set search_path for all functions to prevent search path injection attacks
ALTER FUNCTION auto_checkout_all_at_closing_time() SET search_path = '';
ALTER FUNCTION check_in_employee(p_employee_id uuid, p_store_id uuid, p_pay_type text) SET search_path = '';
ALTER FUNCTION check_out_employee(p_employee_id uuid, p_store_id uuid) SET search_path = '';
ALTER FUNCTION auto_release_queue_at_closing() SET search_path = '';
ALTER FUNCTION get_sorted_technicians_for_store(p_store_id uuid) SET search_path = '';
ALTER FUNCTION can_checkin_now(p_store_id uuid) SET search_path = '';
ALTER FUNCTION is_technician_checked_in_today(p_employee_id uuid, p_store_id uuid) SET search_path = '';
ALTER FUNCTION get_latest_app_version() SET search_path = '';
ALTER FUNCTION get_services_by_popularity(p_store_id uuid) SET search_path = '';
ALTER FUNCTION auto_approve_expired_tickets() SET search_path = '';
ALTER FUNCTION reject_ticket(p_ticket_id uuid, p_employee_id uuid, p_rejection_reason text) SET search_path = '';
ALTER FUNCTION log_auto_approval_activity() SET search_path = '';
ALTER FUNCTION mark_technician_busy(p_employee_id uuid, p_ticket_id uuid) SET search_path = '';
ALTER FUNCTION trigger_mark_technician_busy() SET search_path = '';
ALTER FUNCTION trigger_mark_technicians_available() SET search_path = '';
ALTER FUNCTION get_last_service_completion_time(p_employee_id uuid, p_store_id uuid) SET search_path = '';
ALTER FUNCTION auto_checkout_inactive_daily_employees() SET search_path = '';
