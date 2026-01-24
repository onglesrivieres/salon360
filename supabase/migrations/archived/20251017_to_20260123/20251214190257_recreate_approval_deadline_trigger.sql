/*
  # Recreate Approval Deadline Trigger

  ## Problem
  The trigger `trigger_set_approval_deadline` was not recreated after updating the 
  `set_approval_deadline()` function in migration 20251214185309. This causes the 
  "Failed to close ticket" error because the trigger is still referencing the old 
  function signature.

  ## Changes
  1. Drop and recreate the trigger on sale_tickets table
     - Ensures trigger uses the updated function with NULL handling for performers array

  ## Security
  - No RLS changes
  - Maintains existing trigger security model
*/

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_set_approval_deadline ON public.sale_tickets;

-- Recreate the trigger to use the updated function
CREATE TRIGGER trigger_set_approval_deadline
  BEFORE UPDATE ON public.sale_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_approval_deadline();