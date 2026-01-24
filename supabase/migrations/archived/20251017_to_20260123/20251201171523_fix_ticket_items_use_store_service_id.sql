/*
  # Fix ticket_items to Use store_service_id Instead of service_id

  1. Overview
     - Removes the old service_id foreign key constraint that references global services table
     - Makes service_id nullable (for historical data only)
     - Ensures store_service_id is the primary service reference
     - Fixes "violates foreign key constraint ticket_items_service_id_fkey" error

  2. Problem
     - ticket_items.service_id has FK constraint to global services table
     - Code is inserting store service IDs into service_id field
     - This violates the FK constraint since store service IDs don't exist in global services table
     - Each store should use its own store_services table exclusively

  3. Solution
     - Drop the old service_id foreign key constraint
     - Make service_id nullable (keep for historical reference)
     - Ensure store_service_id is NOT NULL with proper FK to store_services
     - Update any remaining NULL store_service_id values

  4. Impact
     - Allows tickets to use store-specific services correctly
     - Maintains data integrity through store_service_id FK
     - Preserves historical service_id data for reference
     - Each store fully independent with own services
*/

-- Step 1: Drop the old foreign key constraint on service_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_items_service_id_fkey'
    AND table_name = 'ticket_items'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.ticket_items DROP CONSTRAINT ticket_items_service_id_fkey;
  END IF;
END $$;

-- Step 2: Make service_id nullable (it's kept for historical reference only)
ALTER TABLE public.ticket_items ALTER COLUMN service_id DROP NOT NULL;

-- Step 3: Ensure store_service_id column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'ticket_items'
    AND column_name = 'store_service_id'
  ) THEN
    ALTER TABLE public.ticket_items ADD COLUMN store_service_id uuid;
  END IF;
END $$;

-- Step 4: Update any ticket_items that have service_id but no store_service_id
-- Find the corresponding store_service based on the ticket's store and the service_id
UPDATE public.ticket_items ti
SET store_service_id = (
  SELECT ss.id
  FROM public.sale_tickets st
  JOIN public.store_services ss ON ss.store_id = st.store_id AND ss.service_id = ti.service_id
  WHERE ti.sale_ticket_id = st.id
  LIMIT 1
)
WHERE ti.store_service_id IS NULL
  AND ti.service_id IS NOT NULL;

-- Step 5: Set store_service_id to NOT NULL (only if all rows have been migrated)
DO $$
BEGIN
  -- Check if there are any custom services (where both service_id and store_service_id are NULL)
  -- These are allowed to have NULL store_service_id
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_items 
    WHERE store_service_id IS NULL 
    AND (service_id IS NOT NULL OR custom_service_name IS NULL)
    LIMIT 1
  ) THEN
    -- Only make it NOT NULL if all regular services have been migrated
    -- Custom services can have NULL store_service_id
    -- We'll handle this with a check constraint instead
    NULL; -- Don't set NOT NULL, use check constraint below
  END IF;
END $$;

-- Step 6: Add check constraint to ensure either store_service_id OR custom_service_name is provided
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

-- Step 7: Ensure foreign key constraint exists for store_service_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_items_store_service_id_fkey'
    AND table_name = 'ticket_items'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.ticket_items
      ADD CONSTRAINT ticket_items_store_service_id_fkey
      FOREIGN KEY (store_service_id)
      REFERENCES public.store_services(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Step 8: Update index - drop old service_id index, ensure store_service_id index exists
DROP INDEX IF EXISTS public.idx_ticket_items_service_id;

CREATE INDEX IF NOT EXISTS idx_ticket_items_store_service_id
  ON public.ticket_items(store_service_id)
  WHERE store_service_id IS NOT NULL;

-- Step 9: Add helpful comments
COMMENT ON COLUMN public.ticket_items.service_id IS 'DEPRECATED: Legacy reference to global services table. Use store_service_id instead. Kept nullable for historical data only.';
COMMENT ON COLUMN public.ticket_items.store_service_id IS 'PRIMARY: Reference to store-specific service. Required for all non-custom services.';
COMMENT ON COLUMN public.ticket_items.custom_service_name IS 'Custom service name for ad-hoc services not in store catalog. When set, store_service_id can be NULL.';
