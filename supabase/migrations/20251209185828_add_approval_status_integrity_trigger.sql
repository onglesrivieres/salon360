/*
  # Add Approval Status Integrity Trigger

  ## Overview
  Creates a trigger to ensure approval_status and approved_by fields remain consistent.
  This prevents future inconsistencies from occurring.

  ## Validation Rules
  
  1. **Manual Approval Consistency**
     - IF approved_by IS NOT NULL AND approval_status in ('approved', 'auto_approved')
     - THEN approval_status MUST be 'approved' (not 'auto_approved')
  
  2. **Auto-Approval Consistency**
     - IF approved_by IS NULL AND approval_status = 'approved'
     - THEN raise error (invalid state - approved without approver)
  
  3. **Rejected Status** 
     - No special validation needed (rejection_reason field is sufficient)
  
  ## Trigger Behavior
  - Runs BEFORE INSERT OR UPDATE on sale_tickets
  - Auto-corrects manual approvals that were incorrectly marked as auto_approved
  - Raises errors for impossible states (approved without approver)
  - Logs corrections for audit trail
  
  ## Security
  - No RLS changes (trigger runs with table owner permissions)
  - Maintains data integrity automatically
  
  ## Performance
  - Minimal overhead (only validates on write operations)
  - No additional queries required
*/

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.validate_approval_status_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Rule 1: If approved_by is set, status must be 'approved' (not 'auto_approved')
  IF NEW.approved_by IS NOT NULL AND NEW.approval_status = 'auto_approved' THEN
    -- Auto-correct the status
    NEW.approval_status := 'approved';
    
    -- Log a notice for debugging
    RAISE NOTICE 'Auto-corrected ticket % from auto_approved to approved (approved_by is set)', NEW.id;
  END IF;
  
  -- Rule 2: If approval_status is 'approved' but no approver, this is invalid
  IF NEW.approval_status = 'approved' AND NEW.approved_by IS NULL THEN
    -- This shouldn't happen - raise an error
    RAISE EXCEPTION 'Invalid approval state: approval_status is approved but approved_by is NULL for ticket %', NEW.id;
  END IF;
  
  -- Rule 3: If approval_status is 'auto_approved', approved_by must be NULL
  IF NEW.approval_status = 'auto_approved' AND NEW.approved_by IS NOT NULL THEN
    -- This is the inconsistency we're preventing - auto-correct it
    NEW.approval_status := 'approved';
    
    RAISE NOTICE 'Auto-corrected ticket % from auto_approved to approved (approved_by is set)', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS ensure_approval_status_consistency ON public.sale_tickets;

CREATE TRIGGER ensure_approval_status_consistency
  BEFORE INSERT OR UPDATE ON public.sale_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_approval_status_consistency();

-- Add comments
COMMENT ON FUNCTION public.validate_approval_status_consistency() IS 
'Validates and auto-corrects approval_status and approved_by consistency. Ensures manual approvals are never marked as auto_approved.';

COMMENT ON TRIGGER ensure_approval_status_consistency ON public.sale_tickets IS 
'Maintains integrity between approval_status and approved_by fields. Prevents inconsistent approval states.';
