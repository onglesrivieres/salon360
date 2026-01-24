/*
  # Auto-Populate Started At on Ticket Item Creation

  1. Purpose
    - Automatically sets `started_at` timestamp when a new ticket_item is created
    - Ensures all future ticket items have timing data for duration calculations
    - Works at database level regardless of how ticket items are created

  2. Changes
    - Creates a trigger function that sets started_at = NOW() if not provided
    - Adds BEFORE INSERT trigger on ticket_items table

  3. Business Logic
    - If started_at is explicitly provided, use that value
    - If started_at is NULL, automatically set it to NOW()
    - This happens before the row is inserted

  4. Notes
    - Complements application-level timestamp setting
    - Ensures no ticket items are created without started_at going forward
    - Does not affect existing rows (backfilled separately)
*/

-- Create trigger function to auto-populate started_at
CREATE OR REPLACE FUNCTION auto_populate_ticket_item_started_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only set started_at if it's not already provided
  IF NEW.started_at IS NULL THEN
    NEW.started_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS trigger_auto_populate_started_at ON ticket_items;

-- Create the trigger
CREATE TRIGGER trigger_auto_populate_started_at
  BEFORE INSERT ON ticket_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_ticket_item_started_at();
