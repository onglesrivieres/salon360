/*
  # Fix Comprehensive Security and Performance Issues

  ## 1. Performance Issues - Unindexed Foreign Keys
  
  Added indexes for:
  - end_of_day_records.updated_by
  - inventory_activity_log.receipt_id
  - inventory_activity_log.store_id
  - inventory_receipt_items.item_id
  - inventory_receipt_items.receipt_id
  - inventory_receipts.created_by
  - inventory_receipts.recipient_id
  - inventory_transaction_items.item_id
  - inventory_transaction_items.transaction_id
  - inventory_transactions.requested_by_id
  - store_inventory_stock.item_id (already exists)
  - ticket_items.completed_by (already exists)

  ## 2. Performance Issues - Unused Indexes
  
  Removed indexes that are not being used:
  - idx_store_services_code
  - idx_services_archived
  - idx_store_services_archived
  - idx_services_active_archived
  - idx_store_services_active_archived
  - idx_inventory_receipts_approved_by_management
  - idx_inventory_receipts_approved_by_recipient
  - idx_inventory_receipts_rejected_by
  - idx_inventory_transaction_items_master_item_id
  - idx_inventory_transactions_manager_approved_by
  - idx_inventory_transactions_recipient_approved_by
  - idx_end_of_day_records_created_by
  - idx_inventory_activity_log_item_id
  - idx_inventory_activity_log_performed_by

  ## 3. Security Issues - Multiple Permissive Policies
  
  - Remove duplicate "Allow all access to store_services" policy
  - Keep only the specific "Admin, Manager, Supervisor can manage store services" policy

  ## 4. Security Issues - Security Definer View
  
  - Recreate inventory_items view without SECURITY DEFINER
  - Use SECURITY INVOKER instead (default)

  ## 5. Security Issues - Function Search Path Mutable
  
  - Update validate_weekly_schedule function with stable search_path
  - Set search_path to 'public, pg_catalog' and SECURITY INVOKER

  ## Notes
  - All changes are idempotent and safe to run multiple times
  - Indexes are created with IF NOT EXISTS
  - Policies are dropped with IF EXISTS
  - Views are recreated with OR REPLACE
*/

-- ============================================================================
-- SECTION 1: Add Missing Indexes for Foreign Keys
-- ============================================================================

-- All indexes wrapped in conditionals for tables that may not exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'end_of_day_records') THEN
    CREATE INDEX IF NOT EXISTS idx_end_of_day_records_updated_by ON public.end_of_day_records(updated_by);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_activity_log') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_receipt_id ON public.inventory_activity_log(receipt_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_store_id ON public.inventory_activity_log(store_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_receipt_items') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_item_id ON public.inventory_receipt_items(item_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_receipt_id ON public.inventory_receipt_items(receipt_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_receipts') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_receipts_created_by ON public.inventory_receipts(created_by);
    CREATE INDEX IF NOT EXISTS idx_inventory_receipts_recipient_id ON public.inventory_receipts(recipient_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transaction_items') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_item_id ON public.inventory_transaction_items(item_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_transaction_id ON public.inventory_transaction_items(transaction_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transactions') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_requested_by_id ON public.inventory_transactions(requested_by_id);
  END IF;
END $$;

-- ============================================================================
-- SECTION 2: Remove Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS public.idx_store_services_code;
DROP INDEX IF EXISTS public.idx_services_archived;
DROP INDEX IF EXISTS public.idx_store_services_archived;
DROP INDEX IF EXISTS public.idx_services_active_archived;
DROP INDEX IF EXISTS public.idx_store_services_active_archived;
DROP INDEX IF EXISTS public.idx_inventory_receipts_approved_by_management;
DROP INDEX IF EXISTS public.idx_inventory_receipts_approved_by_recipient;
DROP INDEX IF EXISTS public.idx_inventory_receipts_rejected_by;
DROP INDEX IF EXISTS public.idx_inventory_transaction_items_master_item_id;
DROP INDEX IF EXISTS public.idx_inventory_transactions_manager_approved_by;
DROP INDEX IF EXISTS public.idx_inventory_transactions_recipient_approved_by;
DROP INDEX IF EXISTS public.idx_end_of_day_records_created_by;
DROP INDEX IF EXISTS public.idx_inventory_activity_log_item_id;
DROP INDEX IF EXISTS public.idx_inventory_activity_log_performed_by;

-- ============================================================================
-- SECTION 3: Fix Multiple Permissive Policies on store_services
-- ============================================================================

-- Drop the overly permissive policy that allows all access
DROP POLICY IF EXISTS "Allow all access to store_services" ON public.store_services;

-- The "Admin, Manager, Supervisor can manage store services" policy remains
-- This is the only policy needed for store_services

-- ============================================================================
-- SECTION 4: Fix Security Definer View (inventory_items)
-- ============================================================================

-- Drop the existing view
DROP VIEW IF EXISTS public.inventory_items;

-- Recreate the view without SECURITY DEFINER (uses SECURITY INVOKER by default)
-- This view provides a unified view of master items with per-store stock data
CREATE OR REPLACE VIEW public.inventory_items AS
SELECT 
  mii.id,
  mii.code,
  mii.name,
  mii.description,
  mii.category,
  mii.unit,
  COALESCE(sis.unit_cost_override, mii.unit_cost) AS unit_cost,
  COALESCE(sis.reorder_level_override, mii.reorder_level) AS reorder_level,
  COALESCE(sis.quantity_on_hand, 0) AS quantity_on_hand,
  sis.store_id,
  sis.last_counted_at,
  mii.is_active,
  mii.created_at,
  GREATEST(mii.updated_at, COALESCE(sis.updated_at, mii.updated_at)) AS updated_at
FROM public.master_inventory_items mii
LEFT JOIN public.store_inventory_stock sis ON mii.id = sis.item_id
WHERE mii.is_active = true;

-- ============================================================================
-- SECTION 5: Fix Function Search Path (validate_weekly_schedule)
-- ============================================================================

-- Drop existing trigger first
DROP TRIGGER IF EXISTS validate_weekly_schedule_trigger ON public.employees;

-- Recreate the function with stable search_path and SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.validate_weekly_schedule()
RETURNS TRIGGER 
SECURITY INVOKER
SET search_path = public, pg_catalog
LANGUAGE plpgsql
AS $$
DECLARE
  valid_days TEXT[] := ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  schedule_key TEXT;
  day_schedule JSONB;
  is_working_value JSONB;
  start_time_value JSONB;
  end_time_value JSONB;
BEGIN
  -- Allow NULL (means available all days)
  IF NEW.weekly_schedule IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check each key in the schedule
  FOR schedule_key IN SELECT jsonb_object_keys(NEW.weekly_schedule)
  LOOP
    -- Check if key is a valid day name
    IF NOT (schedule_key = ANY(valid_days)) THEN
      RAISE EXCEPTION 'Invalid day name in weekly_schedule: %. Valid days are: monday, tuesday, wednesday, thursday, friday, saturday, sunday', schedule_key;
    END IF;

    day_schedule := NEW.weekly_schedule->schedule_key;

    -- Check if value is an object
    IF jsonb_typeof(day_schedule) != 'object' THEN
      RAISE EXCEPTION 'Invalid value type for day %. Must be object with is_working, start_time, and end_time properties, got: %', schedule_key, jsonb_typeof(day_schedule);
    END IF;

    -- Check for required properties
    IF NOT (day_schedule ? 'is_working') THEN
      RAISE EXCEPTION 'Missing required property is_working for day %', schedule_key;
    END IF;

    IF NOT (day_schedule ? 'start_time') THEN
      RAISE EXCEPTION 'Missing required property start_time for day %', schedule_key;
    END IF;

    IF NOT (day_schedule ? 'end_time') THEN
      RAISE EXCEPTION 'Missing required property end_time for day %', schedule_key;
    END IF;

    -- Validate is_working is boolean
    is_working_value := day_schedule->'is_working';
    IF jsonb_typeof(is_working_value) != 'boolean' THEN
      RAISE EXCEPTION 'Invalid type for is_working in day %. Must be boolean, got: %', schedule_key, jsonb_typeof(is_working_value);
    END IF;

    -- Validate start_time is string
    start_time_value := day_schedule->'start_time';
    IF jsonb_typeof(start_time_value) != 'string' THEN
      RAISE EXCEPTION 'Invalid type for start_time in day %. Must be string, got: %', schedule_key, jsonb_typeof(start_time_value);
    END IF;

    -- Validate end_time is string
    end_time_value := day_schedule->'end_time';
    IF jsonb_typeof(end_time_value) != 'string' THEN
      RAISE EXCEPTION 'Invalid type for end_time in day %. Must be string, got: %', schedule_key, jsonb_typeof(end_time_value);
    END IF;

    -- Validate time format (HH:MM)
    IF NOT (day_schedule->>'start_time' ~ '^\d{2}:\d{2}$') THEN
      RAISE EXCEPTION 'Invalid time format for start_time in day %. Expected HH:MM format, got: %', schedule_key, day_schedule->>'start_time';
    END IF;

    IF NOT (day_schedule->>'end_time' ~ '^\d{2}:\d{2}$') THEN
      RAISE EXCEPTION 'Invalid time format for end_time in day %. Expected HH:MM format, got: %', schedule_key, day_schedule->>'end_time';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER validate_weekly_schedule_trigger
  BEFORE INSERT OR UPDATE OF weekly_schedule ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_weekly_schedule();
