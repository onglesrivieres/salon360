/*
  # Allow NULL store_service_id for Custom Services

  1. Problem
     - store_service_id column has NOT NULL constraint
     - Custom services intentionally use NULL store_service_id (with custom_service_name instead)
     - This causes error: "null value in column 'store_service_id' violates not-null constraint"

  2. Solution
     - Drop the NOT NULL constraint on store_service_id
     - The existing check constraint (ticket_items_service_reference_check) ensures data integrity:
       store_service_id IS NOT NULL OR custom_service_name IS NOT NULL

  3. Impact
     - Custom services can now be saved with NULL store_service_id
     - Regular services still require store_service_id (enforced by check constraint)
*/

-- Drop the NOT NULL constraint to allow custom services
ALTER TABLE public.ticket_items ALTER COLUMN store_service_id DROP NOT NULL;

-- Verify the check constraint exists (it should already be in place from previous migrations)
-- This ensures either store_service_id OR custom_service_name is provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_items_service_reference_check'
    AND table_name = 'ticket_items'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.ticket_items
      ADD CONSTRAINT ticket_items_service_reference_check
      CHECK (
        store_service_id IS NOT NULL OR
        custom_service_name IS NOT NULL
      );
  END IF;
END $$;
