/*
  # Drop Obsolete Check Constraint on ticket_items

  1. Overview
     - Removes the old `ticket_items_service_or_custom_check` constraint
     - This constraint references the deprecated `service_id` field
     - Conflicts with the new schema that uses `store_service_id`

  2. Problem
     - Old constraint: requires (service_id IS NOT NULL) OR (custom_service_name IS NOT NULL)
     - New schema: inserts store_service_id instead of service_id
     - When inserting regular services: service_id = NULL, custom_service_name = NULL, store_service_id = UUID
     - This violates the old constraint causing insert failures

  3. Solution
     - Drop the obsolete `ticket_items_service_or_custom_check` constraint
     - Keep the new `ticket_items_service_reference_check` constraint which correctly validates:
       * store_service_id IS NOT NULL (for catalog services)
       * OR custom_service_name IS NOT NULL (for ad-hoc services)

  4. Impact
     - Allows proper insertion of ticket items with store-specific services
     - Maintains data integrity through the correct constraint
     - No application code changes needed
*/

-- Drop the obsolete check constraint that references service_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_items_service_or_custom_check'
    AND table_name = 'ticket_items'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.ticket_items DROP CONSTRAINT ticket_items_service_or_custom_check;
  END IF;
END $$;

-- Verify the new constraint exists and is correct
DO $$
BEGIN
  -- Ensure the new constraint is in place
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_items_service_reference_check'
    AND table_name = 'ticket_items'
    AND table_schema = 'public'
  ) THEN
    -- Add it if somehow missing
    ALTER TABLE public.ticket_items
      ADD CONSTRAINT ticket_items_service_reference_check
      CHECK (
        store_service_id IS NOT NULL OR 
        custom_service_name IS NOT NULL
      );
  END IF;
END $$;

-- Add helpful comment explaining the constraint
COMMENT ON CONSTRAINT ticket_items_service_reference_check ON public.ticket_items IS 
  'Ensures each ticket item references either a store service (via store_service_id) or a custom service (via custom_service_name). At least one must be provided.';
