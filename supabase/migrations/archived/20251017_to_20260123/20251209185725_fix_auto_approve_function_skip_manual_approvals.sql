/*
  # Fix Auto-Approve Function to Skip Manual Approvals

  ## Overview
  Updates the auto_approve_expired_tickets() function to prevent it from overwriting
  manual approvals. The function will now only auto-approve tickets that don't already
  have an approved_by value set.

  ## Changes Made
  
  1. **Function Logic Update**
     - Add condition: approved_by IS NULL
     - This ensures tickets that were manually approved are never overwritten
     - Only truly pending tickets without manual approval will be auto-approved
  
  2. **Prevented Issue**
     - Stops the cron job from changing 'approved' status to 'auto_approved'
     - Preserves manual approval attribution
     - Maintains data integrity going forward
  
  ## Security
  - No RLS changes (uses existing security model)
  - Function maintains SECURITY DEFINER if previously set
  
  ## Performance
  - Additional WHERE clause condition on indexed column (approved_by)
  - Minimal performance impact
*/

-- Update the auto-approve function to skip tickets with manual approvals
CREATE OR REPLACE FUNCTION public.auto_approve_expired_tickets()
RETURNS json 
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Auto-approve tickets past their deadline
  -- BUT ONLY if they haven't been manually approved already
  UPDATE public.sale_tickets
  SET 
    approval_status = 'auto_approved',
    approved_at = now(),
    updated_at = now()
  WHERE approval_status = 'pending_approval'
    AND approval_deadline < now()
    AND approved_by IS NULL;  -- Critical: don't overwrite manual approvals
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true, 
    'message', format('Auto-approved %s ticket(s)', v_count),
    'count', v_count
  );
END;
$$;

-- Add comment documenting the function's behavior
COMMENT ON FUNCTION public.auto_approve_expired_tickets() IS 
'Auto-approves tickets past their approval deadline. Skips tickets that already have approved_by set (manual approvals).';
