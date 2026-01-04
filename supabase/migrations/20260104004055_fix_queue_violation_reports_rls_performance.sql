/*
  # Fix Queue Violation Reports RLS Performance

  1. Problem
    - "Employees can view reports where they are involved" policy uses auth.uid() multiple times
    - This causes re-evaluation for each row
    
  2. Solution
    - Replace auth.uid() with (select auth.uid())
    - Fix subquery to properly reference violation_report_id
    
  3. Impact
    - Significantly improves query performance at scale
    - Maintains same security boundaries
*/

-- Fix the authenticated users policy
DROP POLICY IF EXISTS "Employees can view reports where they are involved" ON public.queue_violation_reports;
CREATE POLICY "Employees can view reports where they are involved"
  ON public.queue_violation_reports
  FOR SELECT
  TO authenticated
  USING (
    reporter_employee_id = (select auth.uid())
    OR reported_employee_id = (select auth.uid())
    OR (select auth.uid()) = ANY(required_responder_ids)
    OR reviewed_by_employee_id = (select auth.uid())
  );

COMMENT ON POLICY "Employees can view reports where they are involved" ON public.queue_violation_reports IS
'Optimized: Uses (select auth.uid()) to evaluate once per query. Employees can view reports where they are the reporter, reported employee, required responder, or reviewer.';
