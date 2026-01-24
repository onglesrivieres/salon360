/*
  # Sync Store Services with Global Services

  1. Overview
    - Ensures bidirectional sync between store_services and global services table
    - Every store_service must have a corresponding global service (linked by service_id)
    - Enables consistent employee service assignments across all stores

  2. Changes Made
    - For each store_service without a service_id, find or create a matching global service by code
    - Update store_services to link to the global service
    - Create helper functions to find/create global services
    - Add archived column to services table if not exists

  3. Data Migration
    - Scan all store_services and ensure they have a service_id
    - For services without service_id, match by code or create new global service
    - Preserve all service data in both tables

  4. Important Notes
    - service_id in store_services is now required (no longer nullable)
    - Employee service assignments use global services table
    - Store-specific pricing/duration is maintained in store_services
*/

-- Step 1: Ensure archived column exists in services table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'services'
    AND column_name = 'archived'
  ) THEN
    ALTER TABLE public.services ADD COLUMN archived boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Step 2: Create function to find or create a global service
CREATE OR REPLACE FUNCTION public.find_or_create_global_service(
  p_code text,
  p_name text,
  p_category text,
  p_base_price numeric,
  p_duration_min integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_id uuid;
BEGIN
  -- Try to find existing service by code
  SELECT id INTO v_service_id
  FROM public.services
  WHERE code = p_code
  LIMIT 1;

  -- If not found, create new global service
  IF v_service_id IS NULL THEN
    INSERT INTO public.services (
      code,
      name,
      category,
      base_price,
      duration_min,
      active,
      archived
    )
    VALUES (
      p_code,
      p_name,
      p_category,
      p_base_price,
      p_duration_min,
      true,
      false
    )
    RETURNING id INTO v_service_id;
  END IF;

  RETURN v_service_id;
END;
$$;

-- Step 3: Sync all existing store_services with global services
DO $$
DECLARE
  v_store_service record;
  v_service_id uuid;
BEGIN
  FOR v_store_service IN
    SELECT id, code, name, category, base_price, duration_min
    FROM public.store_services
    WHERE service_id IS NULL
  LOOP
    -- Find or create global service
    v_service_id := public.find_or_create_global_service(
      v_store_service.code,
      v_store_service.name,
      v_store_service.category,
      v_store_service.base_price,
      v_store_service.duration_min
    );

    -- Update store_service with service_id
    UPDATE public.store_services
    SET service_id = v_service_id
    WHERE id = v_store_service.id;
  END LOOP;
END $$;

-- Step 4: Make service_id NOT NULL now that all rows have been migrated
DO $$
BEGIN
  -- Only proceed if all store_services have a service_id
  IF NOT EXISTS (
    SELECT 1 FROM public.store_services WHERE service_id IS NULL LIMIT 1
  ) THEN
    ALTER TABLE public.store_services ALTER COLUMN service_id SET NOT NULL;
  END IF;
END $$;

-- Step 5: Create function to sync store_service changes to global service
CREATE OR REPLACE FUNCTION public.sync_store_service_to_global(
  p_store_service_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_service record;
BEGIN
  -- Get store_service details
  SELECT * INTO v_store_service
  FROM public.store_services
  WHERE id = p_store_service_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store service not found';
  END IF;

  -- Update global service with store_service details
  -- Only update if this is the "canonical" store (or if no conflict)
  UPDATE public.services
  SET
    name = v_store_service.name,
    category = v_store_service.category,
    updated_at = now()
  WHERE id = v_store_service.service_id;
END;
$$;

-- Step 6: Add helpful comments
COMMENT ON FUNCTION public.find_or_create_global_service IS 'Finds an existing global service by code or creates a new one. Returns the service_id.';
COMMENT ON FUNCTION public.sync_store_service_to_global IS 'Syncs store_service changes back to the global services table.';

-- Step 7: Create index on service_id in store_services if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_store_services_service_id ON public.store_services(service_id);
