/*
  # Fix All RLS Auth Function Performance Issues

  1. Problem
    - Multiple RLS policies re-evaluate auth.uid() for each row
    - This causes suboptimal performance at scale
    
  2. Solution
    - Replace all instances of `auth.uid()` with `(select auth.uid())`
    - This evaluates the function once and uses the result for all rows
    
  3. Tables Fixed
    - role_permissions_audit
    - queue_violation_responses  
    - cash_transaction_edit_history
    - auto_approval_runs
    - role_permissions
*/

-- Fix role_permissions_audit SELECT policy
DROP POLICY IF EXISTS "Users can read audit logs for their stores" ON public.role_permissions_audit;
CREATE POLICY "Users can read audit logs for their stores"
  ON public.role_permissions_audit
  FOR SELECT
  TO authenticated
  USING (
    store_id IN (
      SELECT es.store_id 
      FROM public.employee_stores es 
      WHERE es.employee_id = (select auth.uid())
    )
  );

-- Fix queue_violation_responses SELECT policy
DROP POLICY IF EXISTS "Employees can view their own responses" ON public.queue_violation_responses;
CREATE POLICY "Employees can view their own responses"
  ON public.queue_violation_responses
  FOR SELECT
  TO authenticated
  USING (employee_id = (select auth.uid()));

-- Fix cash_transaction_edit_history SELECT policy
DROP POLICY IF EXISTS "Users can view edit history for their store" ON public.cash_transaction_edit_history;
CREATE POLICY "Users can view edit history for their store"
  ON public.cash_transaction_edit_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cash_transactions ct
      JOIN public.employees e ON e.id = (select auth.uid())
      JOIN public.employee_stores es ON es.employee_id = e.id
      WHERE ct.id = cash_transaction_edit_history.transaction_id
        AND ct.store_id = es.store_id
    )
  );

-- Fix auto_approval_runs SELECT policy
DROP POLICY IF EXISTS "Managers and above can view auto-approval runs" ON public.auto_approval_runs;
CREATE POLICY "Managers and above can view auto-approval runs"
  ON public.auto_approval_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = (select auth.uid())
        AND (
          'Manager' = ANY(e.role)
          OR 'Admin' = ANY(e.role)
          OR 'Owner' = ANY(e.role)
        )
    )
  );

-- Fix role_permissions SELECT policy
DROP POLICY IF EXISTS "Users can read role permissions for their stores" ON public.role_permissions;
CREATE POLICY "Users can read role permissions for their stores"
  ON public.role_permissions
  FOR SELECT
  TO authenticated
  USING (
    store_id IN (
      SELECT es.store_id 
      FROM public.employee_stores es 
      WHERE es.employee_id = (select auth.uid())
    )
  );

-- Fix role_permissions INSERT policy
DROP POLICY IF EXISTS "Admin and Owner can insert role permissions" ON public.role_permissions;
CREATE POLICY "Admin and Owner can insert role permissions"
  ON public.role_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.employee_stores es ON e.id = es.employee_id
      WHERE e.id = (select auth.uid())
        AND es.store_id = role_permissions.store_id
        AND (
          e.role @> ARRAY['Admin']::text[]
          OR e.role @> ARRAY['Owner']::text[]
        )
    )
  );

-- Fix role_permissions UPDATE policy
DROP POLICY IF EXISTS "Admin and Owner can update role permissions" ON public.role_permissions;
CREATE POLICY "Admin and Owner can update role permissions"
  ON public.role_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.employee_stores es ON e.id = es.employee_id
      WHERE e.id = (select auth.uid())
        AND es.store_id = role_permissions.store_id
        AND (
          e.role @> ARRAY['Admin']::text[]
          OR e.role @> ARRAY['Owner']::text[]
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.employees e
      JOIN public.employee_stores es ON e.id = es.employee_id
      WHERE e.id = (select auth.uid())
        AND es.store_id = role_permissions.store_id
        AND (
          e.role @> ARRAY['Admin']::text[]
          OR e.role @> ARRAY['Owner']::text[]
        )
    )
  );

-- Add helpful comments
COMMENT ON POLICY "Users can read audit logs for their stores" ON public.role_permissions_audit IS
'Optimized: Uses (select auth.uid()) to evaluate once per query instead of per row';

COMMENT ON POLICY "Employees can view their own responses" ON public.queue_violation_responses IS
'Optimized: Uses (select auth.uid()) to evaluate once per query instead of per row';

COMMENT ON POLICY "Users can view edit history for their store" ON public.cash_transaction_edit_history IS
'Optimized: Uses (select auth.uid()) to evaluate once per query instead of per row';

COMMENT ON POLICY "Managers and above can view auto-approval runs" ON public.auto_approval_runs IS
'Optimized: Uses (select auth.uid()) to evaluate once per query instead of per row';

COMMENT ON POLICY "Users can read role permissions for their stores" ON public.role_permissions IS
'Optimized: Uses (select auth.uid()) to evaluate once per query instead of per row';
