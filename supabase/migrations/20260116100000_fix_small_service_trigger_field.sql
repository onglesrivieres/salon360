/*
  # Fix Small Service Trigger Field Mismatch

  ## Problem
  The `trigger_mark_technicians_available` function checks `closed_at`, but the
  trigger fires on `completed_at` changes. This means `handle_ticket_close_smart()`
  is never called, and small_service technicians are never properly returned to
  ready status with their position preserved.

  ## Root Cause
  - Migration 20251209195804 updated trigger to fire on `completed_at`
  - Migration 20260112150003 updated function to check `closed_at`
  - These don't match, so the smart function is never invoked

  ## Solution
  Update the function to check `completed_at` instead of `closed_at`, matching
  what the trigger fires on.

  ## Expected Behavior After Fix
  1. Technician takes small service (last in queue, total < threshold) → small_service (yellow)
  2. Ticket completed (completed_at set) → handle_ticket_close_smart() called
  3. small_service technician → returns to ready status, keeps queue position
  4. busy technician → removed from queue
*/

-- Fix the trigger function to check completed_at (matching the trigger definition)
CREATE OR REPLACE FUNCTION public.trigger_mark_technicians_available()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Check completed_at (not closed_at) since trigger fires on completed_at
  -- completed_at is set when technician finishes service and clicks "Ready"
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    PERFORM public.handle_ticket_close_smart(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_mark_technicians_available() IS
'Handles technician queue status when ticket is completed. Calls handle_ticket_close_smart() which returns small_service technicians to ready (preserving position) and removes busy technicians from queue.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
