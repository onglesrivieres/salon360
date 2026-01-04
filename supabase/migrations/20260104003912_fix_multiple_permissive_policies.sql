/*
  # Fix Multiple Permissive Policies on queue_removals_log

  1. Problem
    - queue_removals_log has multiple permissive SELECT policies for authenticated role
    - This can lead to confusion and potential security gaps
    
  2. Solution
    - Combine the two policies into a single comprehensive policy
    - Employees can view their own records OR if they're management, all records for their stores
    
  3. Security Impact
    - Maintains same access levels but with clearer, single policy
    - Easier to audit and maintain
*/

-- Drop the two separate policies
DROP POLICY IF EXISTS "Employees can view own removal records" ON public.queue_removals_log;
DROP POLICY IF EXISTS "Management can view all removal records for their stores" ON public.queue_removals_log;

-- Create a single combined policy
CREATE POLICY "Employees and management can view removal records"
  ON public.queue_removals_log
  FOR SELECT
  TO authenticated
  USING (
    -- Employees can view their own records
    employee_id = (select auth.uid())
    OR
    -- Management can view all records for their stores
    (
      store_id IN (
        SELECT es.store_id 
        FROM public.employee_stores es 
        JOIN public.employees e ON e.id = es.employee_id
        WHERE es.employee_id = (select auth.uid())
          AND e.role && ARRAY['manager', 'owner', 'admin']::text[]
      )
    )
  );

COMMENT ON POLICY "Employees and management can view removal records" ON public.queue_removals_log IS
'Combined policy: Employees see own records, management sees all records for their stores. Optimized with (select auth.uid())';
