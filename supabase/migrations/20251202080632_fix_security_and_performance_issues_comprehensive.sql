/*
  # Comprehensive Security and Performance Fixes

  ## Changes Made

  1. **Add Missing Foreign Key Indexes**
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

  2. **Remove Unused Indexes**
     - Service-related archived indexes
     - Inventory receipt approval indexes
     - Inventory transaction approval indexes
     - Activity log indexes

  3. **Fix Multiple Permissive Policies**
     - Remove overly permissive "Allow all access to store_services" policy
     - Keep the more specific role-based policy

  4. **Fix Security Definer View**
     - Recreate inventory_items view without SECURITY DEFINER

  5. **Fix Function Search Path**
     - Update validate_weekly_schedule with immutable search_path

  ## Security Notes
     - All changes improve query performance without reducing security
     - RLS policies remain properly enforced
     - Function search paths are now immutable
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

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
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_inventory_stock') THEN
    CREATE INDEX IF NOT EXISTS idx_store_inventory_stock_item_id ON public.store_inventory_stock(item_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ticket_items_completed_by
  ON public.ticket_items(completed_by);

-- =====================================================
-- 2. REMOVE UNUSED INDEXES
-- =====================================================

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

-- =====================================================
-- 3. FIX MULTIPLE PERMISSIVE POLICIES ON STORE_SERVICES
-- =====================================================

-- Drop the overly permissive "Allow all access" policy
DROP POLICY IF EXISTS "Allow all access to store_services" ON public.store_services;

-- Keep the more specific role-based policy
-- "Admin, Manager, Supervisor can manage store services" remains in place

-- =====================================================
-- 4. FIX SECURITY DEFINER VIEW
-- =====================================================

-- Drop and recreate inventory_items view without SECURITY DEFINER
DROP VIEW IF EXISTS public.inventory_items CASCADE;

CREATE OR REPLACE VIEW public.inventory_items
WITH (security_invoker = true)
AS
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
JOIN public.master_inventory_items mi ON mi.id = sis.item_id;

COMMENT ON VIEW public.inventory_items IS 'View of inventory items with security invoker (inherits caller permissions)';

-- =====================================================
-- 5. FIX FUNCTION SEARCH PATH
-- =====================================================

-- Drop and recreate validate_weekly_schedule with immutable search_path
CREATE OR REPLACE FUNCTION public.validate_weekly_schedule(schedule jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Check if schedule is an object
  IF jsonb_typeof(schedule) != 'object' THEN
    RETURN false;
  END IF;

  -- Check that all days are present and are objects with 'enabled' property
  IF NOT (
    schedule ? 'monday' AND jsonb_typeof(schedule->'monday') = 'object' AND
    schedule->'monday' ? 'enabled' AND jsonb_typeof(schedule->'monday'->'enabled') = 'boolean' AND
    
    schedule ? 'tuesday' AND jsonb_typeof(schedule->'tuesday') = 'object' AND
    schedule->'tuesday' ? 'enabled' AND jsonb_typeof(schedule->'tuesday'->'enabled') = 'boolean' AND
    
    schedule ? 'wednesday' AND jsonb_typeof(schedule->'wednesday') = 'object' AND
    schedule->'wednesday' ? 'enabled' AND jsonb_typeof(schedule->'wednesday'->'enabled') = 'boolean' AND
    
    schedule ? 'thursday' AND jsonb_typeof(schedule->'thursday') = 'object' AND
    schedule->'thursday' ? 'enabled' AND jsonb_typeof(schedule->'thursday'->'enabled') = 'boolean' AND
    
    schedule ? 'friday' AND jsonb_typeof(schedule->'friday') = 'object' AND
    schedule->'friday' ? 'enabled' AND jsonb_typeof(schedule->'friday'->'enabled') = 'boolean' AND
    
    schedule ? 'saturday' AND jsonb_typeof(schedule->'saturday') = 'object' AND
    schedule->'saturday' ? 'enabled' AND jsonb_typeof(schedule->'saturday'->'enabled') = 'boolean' AND
    
    schedule ? 'sunday' AND jsonb_typeof(schedule->'sunday') = 'object' AND
    schedule->'sunday' ? 'enabled' AND jsonb_typeof(schedule->'sunday'->'enabled') = 'boolean'
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;