/*
  # Fix Security and Performance Issues - Final Pass

  ## Summary
  Fix all remaining unindexed foreign keys, remove unused indexes,
  fix security definer view, and ensure functions have proper search paths

  ## Changes Made

  ### 1. Add Missing Foreign Key Indexes
  - end_of_day_records.created_by
  - inventory_activity_log.item_id
  - inventory_activity_log.performed_by
  - inventory_receipts foreign keys (approved_by_management, approved_by_recipient, rejected_by)
  - inventory_transaction_items.master_item_id
  - inventory_transactions foreign keys (manager_approved_by_id, recipient_approved_by_id)

  ### 2. Remove Unused Indexes
  - Drop all indexes that have never been used

  ### 3. Fix Security Definer View
  - Alter inventory_items view to remove SECURITY DEFINER

  ### 4. Fix Function Search Paths
  - Ensure all functions have proper immutable search paths
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- end_of_day_records (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'end_of_day_records') THEN
    CREATE INDEX IF NOT EXISTS idx_end_of_day_records_created_by
      ON public.end_of_day_records(created_by);
  END IF;
END $$;

-- inventory_activity_log (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_activity_log') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_item_id
      ON public.inventory_activity_log(item_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_performed_by
      ON public.inventory_activity_log(performed_by);
  END IF;
END $$;

-- inventory_receipts (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_receipts') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_receipts_approved_by_management
      ON public.inventory_receipts(approved_by_management);
    CREATE INDEX IF NOT EXISTS idx_inventory_receipts_approved_by_recipient
      ON public.inventory_receipts(approved_by_recipient);
    CREATE INDEX IF NOT EXISTS idx_inventory_receipts_rejected_by
      ON public.inventory_receipts(rejected_by);
  END IF;
END $$;

-- inventory_transaction_items (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transaction_items') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_master_item_id
      ON public.inventory_transaction_items(master_item_id);
  END IF;
END $$;

-- inventory_transactions (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transactions') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_manager_approved_by
      ON public.inventory_transactions(manager_approved_by_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_recipient_approved_by
      ON public.inventory_transactions(recipient_approved_by_id);
  END IF;
END $$;

-- =====================================================
-- 2. REMOVE ALL UNUSED INDEXES
-- =====================================================

-- Note: These indexes haven't been used and may not be needed
-- They can be recreated later if query patterns show they're necessary

DROP INDEX IF EXISTS public.idx_end_of_day_records_updated_by;
DROP INDEX IF EXISTS public.idx_inventory_activity_log_receipt_id;
DROP INDEX IF EXISTS public.idx_inventory_activity_log_store_id;
DROP INDEX IF EXISTS public.idx_inventory_receipt_items_item_id;
DROP INDEX IF EXISTS public.idx_inventory_receipt_items_receipt_id;
DROP INDEX IF EXISTS public.idx_inventory_receipts_created_by;
DROP INDEX IF EXISTS public.idx_inventory_receipts_recipient_id;
DROP INDEX IF EXISTS public.idx_inventory_transaction_items_item_id;
DROP INDEX IF EXISTS public.idx_inventory_transaction_items_transaction_id;
DROP INDEX IF EXISTS public.idx_inventory_transactions_requested_by_id;
DROP INDEX IF EXISTS public.idx_store_inventory_stock_item_id;
DROP INDEX IF EXISTS public.idx_ticket_items_completed_by;

-- =====================================================
-- 3. FIX SECURITY DEFINER VIEW
-- =====================================================

-- First check if required tables exist, then recreate view
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_inventory_stock') THEN
    RAISE NOTICE 'Skipping inventory_items view - required tables do not exist';
    RETURN;
  END IF;

  -- Drop the view completely and recreate it without SECURITY DEFINER
  DROP VIEW IF EXISTS public.inventory_items CASCADE;

  -- Recreate the view using EXECUTE (views are SECURITY INVOKER by default)
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
      COALESCE(sis.unit_cost_override, mi.unit_cost) as unit_cost,
      COALESCE(sis.reorder_level_override, mi.reorder_level) as reorder_level,
      mi.is_active,
      sis.created_at,
      sis.updated_at,
      mi.id as master_item_id
    FROM public.store_inventory_stock sis
    JOIN public.master_inventory_items mi ON mi.id = sis.item_id
  $view$;

  -- Grant appropriate permissions
  GRANT SELECT ON public.inventory_items TO anon, authenticated;
END $$;

-- =====================================================
-- 4. FIX FUNCTION SEARCH PATHS
-- =====================================================

-- The issue is that the search_path is "role mutable" which means it can be
-- changed by the role executing the function. We need to make it immutable.

-- Drop and recreate validate_weekly_schedule with proper settings
DROP FUNCTION IF EXISTS public.validate_weekly_schedule(jsonb);

CREATE OR REPLACE FUNCTION public.validate_weekly_schedule(schedule jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
-- Use "TO" instead of "=" to make it immutable
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  day_key text;
  day_value jsonb;
  required_keys text[] := ARRAY['is_working', 'start_time', 'end_time'];
  key text;
BEGIN
  IF schedule IS NULL THEN
    RETURN true;
  END IF;

  FOR day_key IN SELECT jsonb_object_keys(schedule)
  LOOP
    IF day_key NOT IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') THEN
      RAISE EXCEPTION 'Invalid day key: %', day_key;
    END IF;

    day_value := schedule->day_key;

    FOREACH key IN ARRAY required_keys
    LOOP
      IF NOT (day_value ? key) THEN
        RAISE EXCEPTION 'Missing required key "%" for day "%"', key, day_key;
      END IF;
    END LOOP;

    IF jsonb_typeof(day_value->'is_working') != 'boolean' THEN
      RAISE EXCEPTION 'is_working must be a boolean for day "%"', day_key;
    END IF;

    IF (day_value->>'is_working')::boolean = true THEN
      IF jsonb_typeof(day_value->'start_time') != 'string' OR 
         jsonb_typeof(day_value->'end_time') != 'string' THEN
        RAISE EXCEPTION 'start_time and end_time must be strings when is_working is true for day "%"', day_key;
      END IF;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- Drop and recreate get_sorted_technicians_for_store with proper settings
DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid, text);

CREATE OR REPLACE FUNCTION public.get_sorted_technicians_for_store(
  p_store_id uuid,
  p_date text
)
RETURNS TABLE (
  employee_id uuid,
  display_name text,
  role text[],
  queue_status text,
  queue_position integer,
  current_ticket_id uuid,
  ticket_customer_name text,
  ticket_start_time timestamptz,
  estimated_duration_min integer,
  time_elapsed_min integer,
  time_remaining_min integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
-- Use "TO" instead of "=" to make it immutable
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  WITH current_tickets AS (
    SELECT 
      ti.employee_id,
      st.id as ticket_id,
      st.customer_name,
      st.opened_at as start_time,
      EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - st.opened_at))/60 as elapsed_min
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
  ),
  estimated_durations AS (
    SELECT 
      ti.employee_id,
      SUM(s.estimated_duration_minutes) as total_estimated_min
    FROM public.ticket_items ti
    JOIN public.services s ON s.id = ti.service_id
    JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
    GROUP BY ti.employee_id
  )
  SELECT 
    e.id as employee_id,
    e.display_name,
    e.role,
    CASE 
      WHEN ct.employee_id IS NOT NULL THEN 'busy'::text
      WHEN q.employee_id IS NOT NULL THEN 'ready'::text
      ELSE 'unavailable'::text
    END as queue_status,
    q.queue_position::integer,
    ct.ticket_id as current_ticket_id,
    ct.customer_name as ticket_customer_name,
    ct.start_time as ticket_start_time,
    ed.total_estimated_min::integer as estimated_duration_min,
    ct.elapsed_min::integer as time_elapsed_min,
    GREATEST(0, COALESCE(ed.total_estimated_min, 0) - COALESCE(ct.elapsed_min, 0))::integer as time_remaining_min
  FROM public.employees e
  LEFT JOIN public.technician_ready_queue q ON q.employee_id = e.id 
    AND q.store_id = p_store_id
    AND q.work_date = p_date::date
  LEFT JOIN current_tickets ct ON ct.employee_id = e.id
  LEFT JOIN estimated_durations ed ON ed.employee_id = e.id
  WHERE (e.role && ARRAY['Technician', 'Spa Expert', 'Supervisor']::text[])
    AND NOT (e.role && ARRAY['Cashier']::text[])
    AND (e.store_id IS NULL OR e.store_id = p_store_id)
    AND (e.status = 'Active' OR e.status = 'active')
  ORDER BY 
    CASE 
      WHEN ct.employee_id IS NOT NULL THEN 2
      WHEN q.employee_id IS NOT NULL THEN 1
      ELSE 3
    END,
    q.queue_position NULLS LAST,
    e.display_name;
END;
$$;

-- Reload schema
NOTIFY pgrst, 'reload schema';
