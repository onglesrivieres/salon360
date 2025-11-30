/*
  # Add archived status to services and store_services

  1. Changes to Tables
    - Add `archived` column to `services` table (boolean, default: false)
    - Add `archived` column to `store_services` table (boolean, default: false)
    
  2. Purpose
    - Distinguish between temporarily inactive and permanently archived services
    - Service states:
      - Active: active=true, archived=false (available for use)
      - Inactive: active=false, archived=false (temporarily unavailable)
      - Archived: archived=true (permanently removed from active use, preserves history)
    
  3. Performance
    - Add index on archived column for efficient filtering
    
  4. Data Integrity
    - No existing data is modified
    - All existing services default to archived=false
*/

-- Add archived column to services table
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

-- Add archived column to store_services table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'store_services'
    AND column_name = 'archived'
  ) THEN
    ALTER TABLE public.store_services ADD COLUMN archived boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_services_archived ON public.services(archived);
CREATE INDEX IF NOT EXISTS idx_store_services_archived ON public.store_services(archived);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_services_active_archived ON public.services(active, archived);
CREATE INDEX IF NOT EXISTS idx_store_services_active_archived ON public.store_services(active, archived);