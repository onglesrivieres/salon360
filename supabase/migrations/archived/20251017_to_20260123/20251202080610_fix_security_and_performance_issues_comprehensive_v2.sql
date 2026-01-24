/*
  # Fix Security and Performance Issues - Comprehensive Fix

  ## Changes Made

  ### 1. Add Missing Foreign Key Indexes (12 indexes)
  - `end_of_day_records.updated_by`
  - `inventory_activity_log.receipt_id`
  - `inventory_activity_log.store_id`
  - `inventory_receipt_items.item_id`
  - `inventory_receipt_items.receipt_id`
  - `inventory_receipts.created_by`
  - `inventory_receipts.recipient_id`
  - `inventory_transaction_items.item_id`
  - `inventory_transaction_items.transaction_id`
  - `inventory_transactions.requested_by_id`
  - `store_inventory_stock.item_id`
  - `ticket_items.completed_by`

  ### 2. Remove Unused Indexes (14 indexes)
  - Removes indexes that are not being utilized by queries
  - Improves write performance and reduces storage overhead

  ### 3. Fix Multiple Permissive Policies
  - Remove duplicate "Allow all access to store_services" policy
  - Keep only the role-based policy for proper access control

  ### 4. Fix Security Definer View
  - Recreate inventory_items view without SECURITY DEFINER
  - Uses proper join between store_inventory_stock and master_inventory_items

  ### 5. Fix Function Search Path
  - Update validate_weekly_schedule function with immutable search_path
  - Prevents search_path manipulation attacks

  ## Security Notes
  - All changes improve performance without compromising security
  - RLS policies remain properly restrictive
  - Function search paths are now immutable
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

-- All indexes on tables that may not exist are wrapped in conditionals
DO $$
BEGIN
  -- end_of_day_records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'end_of_day_records') THEN
    CREATE INDEX IF NOT EXISTS idx_end_of_day_records_updated_by ON public.end_of_day_records(updated_by);
  END IF;
  -- inventory_activity_log
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_activity_log') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_receipt_id ON public.inventory_activity_log(receipt_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_store_id ON public.inventory_activity_log(store_id);
  END IF;
  -- inventory_receipt_items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_receipt_items') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_item_id ON public.inventory_receipt_items(item_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_receipt_id ON public.inventory_receipt_items(receipt_id);
  END IF;
  -- inventory_receipts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_receipts') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_receipts_created_by ON public.inventory_receipts(created_by);
    CREATE INDEX IF NOT EXISTS idx_inventory_receipts_recipient_id ON public.inventory_receipts(recipient_id);
  END IF;
  -- inventory_transaction_items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transaction_items') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_item_id ON public.inventory_transaction_items(item_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_transaction_id ON public.inventory_transaction_items(transaction_id);
  END IF;
  -- inventory_transactions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transactions') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_requested_by_id ON public.inventory_transactions(requested_by_id);
  END IF;
  -- store_inventory_stock
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_inventory_stock') THEN
    CREATE INDEX IF NOT EXISTS idx_store_inventory_stock_item_id ON public.store_inventory_stock(item_id);
  END IF;
END $$;

-- ticket_items (Note: This index was already created and then removed as unused)
-- We're adding it back because it's a foreign key that should be indexed
CREATE INDEX IF NOT EXISTS idx_ticket_items_completed_by 
  ON public.ticket_items(completed_by);

-- ============================================================================
-- 2. REMOVE UNUSED INDEXES
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
-- 3. FIX MULTIPLE PERMISSIVE POLICIES ON STORE_SERVICES
-- ============================================================================

-- Remove the overly permissive "Allow all access" policy
DROP POLICY IF EXISTS "Allow all access to store_services" ON public.store_services;

-- The role-based policy "Admin, Manager, Supervisor can manage store services" remains

-- ============================================================================
-- 4. FIX SECURITY DEFINER VIEW
-- ============================================================================

-- Drop and recreate the inventory_items view without SECURITY DEFINER (only if tables exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_inventory_stock') THEN
    RAISE NOTICE 'Skipping inventory_items view - required tables do not exist';
    RETURN;
  END IF;

  DROP VIEW IF EXISTS public.inventory_items CASCADE;

  EXECUTE $view$
    CREATE VIEW public.inventory_items AS
    SELECT
      sis.id,
      sis.store_id,
      mi.code,
      mi.name,
      mi.description,
      mi.category,
      mi.unit,
      sis.quantity_on_hand,
      COALESCE(sis.unit_cost_override, mi.unit_cost) AS unit_cost,
      COALESCE(sis.reorder_level_override, mi.reorder_level) AS reorder_level,
      mi.is_active,
      sis.created_at,
      sis.updated_at,
      mi.id AS master_item_id
    FROM public.store_inventory_stock sis
    JOIN public.master_inventory_items mi ON mi.id = sis.item_id
  $view$;

  GRANT SELECT ON public.inventory_items TO anon, authenticated;
END $$;

-- ============================================================================
-- 5. FIX FUNCTION SEARCH PATH
-- ============================================================================

-- Recreate the validate_weekly_schedule function with secure search_path
CREATE OR REPLACE FUNCTION public.validate_weekly_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Check if weekly_schedule is not null and is a valid JSONB object
  IF NEW.weekly_schedule IS NOT NULL THEN
    -- Validate that it's an object (not an array or primitive)
    IF jsonb_typeof(NEW.weekly_schedule) != 'object' THEN
      RAISE EXCEPTION 'weekly_schedule must be a JSON object';
    END IF;

    -- Validate that all keys are valid day names
    IF EXISTS (
      SELECT 1
      FROM jsonb_object_keys(NEW.weekly_schedule) AS key
      WHERE key NOT IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    ) THEN
      RAISE EXCEPTION 'weekly_schedule contains invalid day names. Valid days are: monday, tuesday, wednesday, thursday, friday, saturday, sunday';
    END IF;

    -- Validate that all values are objects with 'enabled' property
    IF EXISTS (
      SELECT 1
      FROM jsonb_each(NEW.weekly_schedule) AS item
      WHERE jsonb_typeof(item.value) != 'object' 
         OR NOT (item.value ? 'enabled')
         OR jsonb_typeof(item.value->'enabled') != 'boolean'
    ) THEN
      RAISE EXCEPTION 'Each day in weekly_schedule must be an object with an "enabled" boolean property';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;