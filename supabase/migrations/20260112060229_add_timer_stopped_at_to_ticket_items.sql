/*
  # Add Timer Stop Tracking to Ticket Items

  ## Purpose
  Support sequential service timers where adding a new service stops
  the previous service's timer (without marking it completed).

  ## Changes
  - Add `timer_stopped_at` column to ticket_items table
  - Add index for query performance

  ## Business Logic
  - started_at: When service begins (auto-populated on insert by existing trigger)
  - timer_stopped_at: When timer is stopped (e.g., when next service is saved)
  - completed_at: When service work is actually finished

  ## Timer Duration Calculation
  - If timer_stopped_at IS NOT NULL: duration = timer_stopped_at - started_at
  - Else if completed_at IS NOT NULL: duration = completed_at - started_at
  - Else: duration = NOW() - started_at (active timer)
*/

-- Add timer_stopped_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ticket_items' AND column_name = 'timer_stopped_at'
  ) THEN
    ALTER TABLE ticket_items ADD COLUMN timer_stopped_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Create index for query performance (finding active timers)
CREATE INDEX IF NOT EXISTS idx_ticket_items_timer_stopped_at
  ON ticket_items(timer_stopped_at);

-- Add comment explaining the field
COMMENT ON COLUMN ticket_items.timer_stopped_at IS
  'Timestamp when service timer was stopped (e.g., when next service added).
   Distinct from completed_at which marks when work finished.';
