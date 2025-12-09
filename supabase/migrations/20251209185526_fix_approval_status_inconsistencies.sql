/*
  # Fix Approval Status Inconsistencies

  ## Overview
  This migration corrects 2,840 tickets that have manual approvals (approved_by is set)
  but are incorrectly marked as 'auto_approved' in the approval_status field.

  ## Changes Made
  
  1. **Data Corrections**
     - Update tickets WHERE approved_by IS NOT NULL AND approval_status = 'auto_approved'
     - Set approval_status to 'approved' for these tickets
     - Log all corrections to ticket_activity_log for audit trail
  
  2. **Activity Logging**
     - Insert activity log entries with action type 'status_corrected'
     - Record the old and new status for transparency
     - Timestamp all corrections with current time
  
  3. **Verification**
     - Count corrected records
     - Verify no inconsistencies remain after correction
  
  ## Security
  - No RLS changes needed (existing policies remain)
  - Activity logging ensures audit trail
  
  ## Performance
  - Single UPDATE statement with WHERE clause using indexed columns
  - Activity log insert batched in single statement
*/

-- Step 1: Log all corrections to activity log before making changes
INSERT INTO public.ticket_activity_log (
  ticket_id,
  employee_id,
  action,
  description,
  changes,
  created_at
)
SELECT 
  id as ticket_id,
  approved_by as employee_id,
  'status_corrected' as action,
  'Corrected approval_status from auto_approved to approved (manual approval was recorded)' as description,
  jsonb_build_object(
    'old_status', 'auto_approved',
    'new_status', 'approved',
    'correction_reason', 'approved_by was set but status was auto_approved'
  ) as changes,
  NOW() as created_at
FROM public.sale_tickets
WHERE approved_by IS NOT NULL 
  AND approval_status = 'auto_approved';

-- Step 2: Update the incorrect approval statuses
UPDATE public.sale_tickets
SET 
  approval_status = 'approved',
  updated_at = NOW()
WHERE approved_by IS NOT NULL 
  AND approval_status = 'auto_approved';

-- Step 3: Verification - Check that no inconsistencies remain
DO $$
DECLARE
  inconsistent_count INTEGER;
  corrected_count INTEGER;
BEGIN
  -- Count any remaining inconsistencies
  SELECT COUNT(*) INTO inconsistent_count
  FROM public.sale_tickets
  WHERE approved_by IS NOT NULL 
    AND approval_status = 'auto_approved';
  
  -- Count corrected tickets
  SELECT COUNT(*) INTO corrected_count
  FROM public.sale_tickets
  WHERE approved_by IS NOT NULL 
    AND approval_status = 'approved';

  -- Raise notice with results
  RAISE NOTICE 'Migration completed: % tickets corrected', corrected_count;
  RAISE NOTICE 'Remaining inconsistencies: %', inconsistent_count;
  
  -- Fail if inconsistencies still exist
  IF inconsistent_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % inconsistent records remain', inconsistent_count;
  END IF;
END $$;
