/*
  # Backfill Completion Time for Existing Closed Tickets

  ## Overview
  Retroactively sets completed_at to closed_at for all existing tickets that have been closed
  but don't have a completion time set. This ensures historical data has consistent completion
  duration tracking.

  ## Changes

  1. Data Update
    - Updates all sale_tickets where closed_at IS NOT NULL and completed_at IS NULL
    - Sets completed_at = closed_at
    - Sets completed_by = closed_by
    - Records number of affected tickets

  ## Business Logic
  - Applies same completion time logic retroactively to existing closed tickets
  - Maintains data consistency across all tickets, old and new
  - Enables accurate completion duration calculations for all historical tickets

  ## Notes
  - This migration is idempotent and can be run multiple times safely
  - Only affects tickets that are closed but not completed
  - Preserves existing completed_at values where they already exist
*/

-- Update existing closed tickets to have completed_at if they don't already
DO $$
DECLARE
  v_updated_count int;
BEGIN
  -- Update tickets where closed_at is set but completed_at is null
  UPDATE sale_tickets
  SET 
    completed_at = closed_at,
    completed_by = closed_by,
    updated_at = NOW()
  WHERE closed_at IS NOT NULL
    AND completed_at IS NULL;

  -- Get count of updated records
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Log the result
  RAISE NOTICE 'Backfilled completed_at for % closed tickets', v_updated_count;
END $$;
