/*
  # Add Missing Approval Columns to sale_tickets
  
  ## Overview
  Adds the missing approval tracking columns that are referenced in the approval functions
  but were never added to the database.
  
  ## New Columns
  - approval_required_level (text) - Indicates minimum role level required ('technician', 'supervisor', 'manager')
  - approval_reason (text) - Human-readable reason for the approval requirement
  - performed_and_closed_by_same_person (boolean) - Flag when same person did service and closed
  
  ## Changes
  1. Add missing columns with appropriate defaults
  2. Create index for performance
  3. Backfill existing tickets with reasonable defaults
  
  ## Security
  - Uses existing RLS policies
  - Maintains audit trail of approval requirements
*/

-- Add missing approval metadata columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_tickets' AND column_name = 'approval_required_level'
  ) THEN
    ALTER TABLE sale_tickets ADD COLUMN approval_required_level text DEFAULT 'technician';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_tickets' AND column_name = 'approval_reason'
  ) THEN
    ALTER TABLE sale_tickets ADD COLUMN approval_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_tickets' AND column_name = 'performed_and_closed_by_same_person'
  ) THEN
    ALTER TABLE sale_tickets ADD COLUMN performed_and_closed_by_same_person boolean DEFAULT false;
  END IF;
END $$;

-- Create index for performance on approval_required_level
CREATE INDEX IF NOT EXISTS idx_sale_tickets_approval_required_level
  ON sale_tickets(approval_required_level)
  WHERE approval_status = 'pending_approval';

-- Backfill existing tickets with default values based on requires_higher_approval
UPDATE sale_tickets
SET
  approval_required_level = CASE
    WHEN requires_higher_approval = true THEN 'manager'
    ELSE 'technician'
  END,
  approval_reason = CASE
    WHEN requires_higher_approval = true THEN 'Requires management approval'
    ELSE 'Standard peer approval'
  END,
  performed_and_closed_by_same_person = false
WHERE approval_status IS NOT NULL
  AND (approval_required_level IS NULL OR approval_reason IS NULL);
