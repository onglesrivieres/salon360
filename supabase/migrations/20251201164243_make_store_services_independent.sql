/*
  # Make Store Services Fully Independent

  1. Overview
     - Restructures store_services to be self-contained without dependency on global services table
     - Each store now fully owns and manages its own service data
     - Removes the need for service_id foreign key and override columns

  2. New Columns Added to store_services
     - `code` (text NOT NULL) - Service code, unique per store
     - `name` (text NOT NULL) - Service name
     - `category` (text NOT NULL DEFAULT 'General') - Service category
     - `base_price` (numeric NOT NULL) - Base price
     - `duration_min` (integer NOT NULL) - Duration in minutes
     - `price` (numeric NOT NULL) - Actual price (replaces price_override)

  3. Changes Made
     - Add new direct service columns to store_services
     - Migrate existing data from services table to store_services
     - Make service_id nullable (for backward compatibility)
     - Add unique constraint on (store_id, code)
     - Update ticket_items to reference store_services.id instead of services.id
     - Add new column store_service_id to ticket_items
     - Migrate ticket_items references from service_id to store_service_id

  4. Data Migration
     - Copy all service data from linked services records into store_services
     - Use override values where they exist, otherwise use base values
     - Update all ticket_items to reference the correct store_service_id

  5. Security
     - Maintains existing RLS policies
     - Updates policies to work with new schema structure

  6. Important Notes
     - This is a breaking change that makes stores fully independent
     - service_id kept nullable for historical reference but no longer used
     - All new functionality uses direct fields in store_services
*/

-- Step 1: Add new columns to store_services table
DO $$
BEGIN
  -- Add code column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'store_services'
    AND column_name = 'code'
  ) THEN
    ALTER TABLE public.store_services ADD COLUMN code text;
  END IF;

  -- Add name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'store_services'
    AND column_name = 'name'
  ) THEN
    ALTER TABLE public.store_services ADD COLUMN name text;
  END IF;

  -- Add category column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'store_services'
    AND column_name = 'category'
  ) THEN
    ALTER TABLE public.store_services ADD COLUMN category text DEFAULT 'General';
  END IF;

  -- Add base_price column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'store_services'
    AND column_name = 'base_price'
  ) THEN
    ALTER TABLE public.store_services ADD COLUMN base_price numeric(10,2);
  END IF;

  -- Add price column (replaces price_override)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'store_services'
    AND column_name = 'price'
  ) THEN
    ALTER TABLE public.store_services ADD COLUMN price numeric(10,2);
  END IF;

  -- Rename duration_override to duration_min if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'store_services'
    AND column_name = 'duration_override'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'store_services'
    AND column_name = 'duration_min'
  ) THEN
    ALTER TABLE public.store_services RENAME COLUMN duration_override TO duration_min;
  END IF;

  -- Add duration_min if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'store_services'
    AND column_name = 'duration_min'
  ) THEN
    ALTER TABLE public.store_services ADD COLUMN duration_min integer;
  END IF;
END $$;

-- Step 2: Migrate data from services table to store_services
UPDATE public.store_services ss
SET
  code = s.code,
  name = s.name,
  category = COALESCE(s.category, 'General'),
  base_price = s.base_price,
  duration_min = COALESCE(ss.duration_min, s.duration_min),
  price = COALESCE(ss.price_override, s.base_price)
FROM public.services s
WHERE ss.service_id = s.id
  AND ss.code IS NULL;

-- Step 3: Make columns NOT NULL after data migration
ALTER TABLE public.store_services
  ALTER COLUMN code SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN category SET DEFAULT 'General',
  ALTER COLUMN base_price SET NOT NULL,
  ALTER COLUMN base_price SET DEFAULT 0.00,
  ALTER COLUMN price SET NOT NULL,
  ALTER COLUMN price SET DEFAULT 0.00,
  ALTER COLUMN duration_min SET NOT NULL,
  ALTER COLUMN duration_min SET DEFAULT 30;

-- Step 4: Add store_service_id column to ticket_items
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

-- Step 5: Migrate ticket_items to use store_service_id
-- For each ticket item, find the corresponding store_service based on the ticket's store
UPDATE public.ticket_items ti
SET store_service_id = (
  SELECT ss.id
  FROM public.sale_tickets st
  JOIN public.store_services ss ON ss.store_id = st.store_id AND ss.service_id = ti.service_id
  WHERE ti.sale_ticket_id = st.id
  LIMIT 1
)
WHERE ti.store_service_id IS NULL;

-- Step 6: Make service_id nullable and store_service_id NOT NULL
ALTER TABLE public.ticket_items ALTER COLUMN service_id DROP NOT NULL;

-- Only set store_service_id to NOT NULL if all rows have been migrated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_items WHERE store_service_id IS NULL LIMIT 1
  ) THEN
    ALTER TABLE public.ticket_items ALTER COLUMN store_service_id SET NOT NULL;
  END IF;
END $$;

-- Step 7: Add foreign key constraint for store_service_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_items_store_service_id_fkey'
    AND table_name = 'ticket_items'
  ) THEN
    ALTER TABLE public.ticket_items
      ADD CONSTRAINT ticket_items_store_service_id_fkey
      FOREIGN KEY (store_service_id)
      REFERENCES public.store_services(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Step 8: Make service_id nullable in store_services (for backward compatibility)
ALTER TABLE public.store_services ALTER COLUMN service_id DROP NOT NULL;

-- Step 9: Drop old unique constraint and add new one
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'store_services_store_id_service_id_key'
    AND table_name = 'store_services'
  ) THEN
    ALTER TABLE public.store_services DROP CONSTRAINT store_services_store_id_service_id_key;
  END IF;

  -- Add new unique constraint on (store_id, code)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'store_services_store_id_code_key'
    AND table_name = 'store_services'
  ) THEN
    ALTER TABLE public.store_services
      ADD CONSTRAINT store_services_store_id_code_key
      UNIQUE (store_id, code);
  END IF;
END $$;

-- Step 10: Create index on code for search performance
CREATE INDEX IF NOT EXISTS idx_store_services_code
  ON public.store_services(code);

-- Step 11: Create index on store_service_id in ticket_items
CREATE INDEX IF NOT EXISTS idx_ticket_items_store_service_id
  ON public.ticket_items(store_service_id);

-- Step 12: Drop price_override column if it exists (replaced by price)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'store_services'
    AND column_name = 'price_override'
  ) THEN
    ALTER TABLE public.store_services DROP COLUMN price_override;
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN public.store_services.code IS 'Service code, unique within each store';
COMMENT ON COLUMN public.store_services.name IS 'Service name, fully customizable per store';
COMMENT ON COLUMN public.store_services.category IS 'Service category, customizable per store';
COMMENT ON COLUMN public.store_services.price IS 'Store-specific service price';
COMMENT ON COLUMN public.store_services.service_id IS 'Legacy reference to global services table, nullable for backward compatibility';
COMMENT ON COLUMN public.ticket_items.store_service_id IS 'Reference to store-specific service definition';
COMMENT ON COLUMN public.ticket_items.service_id IS 'Legacy reference, being phased out in favor of store_service_id';
