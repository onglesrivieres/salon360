/*
  # Auto-Populate Completion Time from Closed Time

  ## Overview
  Automatically sets completed_at to closed_at when a ticket is closed without being explicitly marked as completed.
  This ensures every closed ticket has a completion time for duration tracking and analytics.

  ## Changes

  1. New Trigger Function
    - `auto_set_completed_at_on_close()` - Automatically copies closed_at to completed_at when a ticket is closed
    - Only applies when closed_at is being set and completed_at is still null
    - Also copies closed_by to completed_by for consistency

  2. New Trigger
    - `auto_set_completed_at_trigger` - Fires before update on sale_tickets table
    - Ensures database-level consistency even if updates come from sources other than the frontend

  ## Business Logic
  - When a ticket is closed (closed_at set from null to a value) and completed_at is still null,
    automatically set completed_at to the same value as closed_at
  - This maintains consistency in completion duration calculations
  - No changes to deviation thresholds or color coding - all tickets use the same logic

  ## Notes
  - This is a preventive measure that works alongside frontend logic
  - Ensures data consistency at the database level
  - A separate migration will handle retroactive updates for existing data
*/

-- Create trigger function to auto-set completed_at when closing a ticket
CREATE OR REPLACE FUNCTION auto_set_completed_at_on_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Check if ticket is being closed (closed_at is being set from null to a value)
  IF NEW.closed_at IS NOT NULL AND (OLD.closed_at IS NULL OR OLD.closed_at IS DISTINCT FROM NEW.closed_at) THEN
    -- If completed_at is not already set, copy closed_at to completed_at
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NEW.closed_at;
      NEW.completed_by := NEW.closed_by;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if it exists (to allow re-running migration)
DROP TRIGGER IF EXISTS auto_set_completed_at_trigger ON sale_tickets;

-- Create trigger that fires before update on sale_tickets
CREATE TRIGGER auto_set_completed_at_trigger
  BEFORE UPDATE ON sale_tickets
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_completed_at_on_close();
