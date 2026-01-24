/*
  # Fix Security and Performance Issues

  ## Summary
  Comprehensive fix for security advisor warnings and performance issues

  ## Changes Made

  ### 1. Add Missing Indexes for Foreign Keys
  - end_of_day_records.created_by
  - inventory_activity_log.item_id
  - inventory_activity_log.performed_by
  - inventory_receipts foreign keys (approved_by_management, approved_by_recipient, rejected_by)
  - inventory_transaction_items.master_item_id
  - inventory_transactions foreign keys (manager_approved_by_id, recipient_approved_by_id)

  ### 2. Fix Auth RLS Initialization Issues
  - Wrap auth.uid() calls in subqueries for inventory_receipts policies
  - Wrap auth.uid() calls in subqueries for inventory_receipt_items policies

  ### 3. Remove Unused Indexes
  - Drop indexes that have never been used per database advisor

  ### 4. Fix Multiple Permissive Policies
  - Remove duplicate policies on stores and suppliers tables

  ### 5. Remove Duplicate Indexes
  - Drop duplicate idx_inventory_items_store on inventory_items_old

  ### 6. Fix Security Definer View
  - Recreate inventory_items view without SECURITY DEFINER

  ### 7. Fix Function Search Path Issues
  - Add explicit search_path to functions
*/

-- =====================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- =====================================================

-- end_of_day_records indexes (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'end_of_day_records') THEN
    CREATE INDEX IF NOT EXISTS idx_end_of_day_records_created_by
      ON public.end_of_day_records(created_by);
  END IF;
END $$;

-- inventory_activity_log indexes (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_activity_log') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_item_id
      ON public.inventory_activity_log(item_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_performed_by
      ON public.inventory_activity_log(performed_by);
  END IF;
END $$;

-- inventory_receipts indexes (only if table exists)
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

-- inventory_transaction_items indexes (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transaction_items') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_master_item_id
      ON public.inventory_transaction_items(master_item_id);
  END IF;
END $$;

-- inventory_transactions indexes (only if table exists)
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
-- 2. FIX AUTH RLS INITIALIZATION ISSUES
-- =====================================================

-- Skip ALL inventory-related policy updates if tables don't exist
-- This section requires inventory_receipts, inventory_receipt_items tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_receipts') THEN
    RAISE NOTICE 'Skipping inventory policies - tables do not exist';
    RETURN;
  END IF;

  -- inventory_receipts policies
  EXECUTE 'DROP POLICY IF EXISTS "Receptionists and management can create receipts" ON public.inventory_receipts';
  EXECUTE $policy$
    CREATE POLICY "Receptionists and management can create receipts"
      ON public.inventory_receipts FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE employees.id = (select auth.uid())
          AND (
            'Receptionist' = ANY(employees.role) OR
            'Manager' = ANY(employees.role) OR
            'Owner' = ANY(employees.role)
          )
        )
      )
  $policy$;

  EXECUTE 'DROP POLICY IF EXISTS "Creators and management can update receipts" ON public.inventory_receipts';
  EXECUTE $policy$
    CREATE POLICY "Creators and management can update receipts"
      ON public.inventory_receipts FOR UPDATE
      TO authenticated
      USING (
        created_by = (select auth.uid()) OR
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE employees.id = (select auth.uid())
          AND ('Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
        )
      )
  $policy$;

  EXECUTE 'DROP POLICY IF EXISTS "Management can delete receipts" ON public.inventory_receipts';
  EXECUTE $policy$
    CREATE POLICY "Management can delete receipts"
      ON public.inventory_receipts FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE employees.id = (select auth.uid())
          AND ('Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
        )
      )
  $policy$;
END $$;

-- Drop and recreate inventory_receipt_items policies with optimized auth calls
-- Skip if table doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_receipt_items') THEN
    RAISE NOTICE 'Skipping inventory_receipt_items policies - table does not exist';
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS "Receptionists and management can create receipt items" ON public.inventory_receipt_items';
  EXECUTE $policy$
    CREATE POLICY "Receptionists and management can create receipt items"
      ON public.inventory_receipt_items FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.employees
          WHERE employees.id = (select auth.uid())
          AND (
            'Receptionist' = ANY(employees.role) OR
            'Manager' = ANY(employees.role) OR
            'Owner' = ANY(employees.role)
          )
        )
      )
  $policy$;

  EXECUTE 'DROP POLICY IF EXISTS "Creators can update receipt items" ON public.inventory_receipt_items';
  EXECUTE $policy$
    CREATE POLICY "Creators can update receipt items"
      ON public.inventory_receipt_items FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.inventory_receipts
          WHERE inventory_receipts.id = inventory_receipt_items.receipt_id
          AND (
            inventory_receipts.created_by = (select auth.uid()) OR
            EXISTS (
              SELECT 1 FROM public.employees
              WHERE employees.id = (select auth.uid())
              AND ('Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
            )
          )
        )
      )
  $policy$;

  EXECUTE 'DROP POLICY IF EXISTS "Creators can delete receipt items" ON public.inventory_receipt_items';
  EXECUTE $policy$
    CREATE POLICY "Creators can delete receipt items"
      ON public.inventory_receipt_items FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.inventory_receipts
          WHERE inventory_receipts.id = inventory_receipt_items.receipt_id
          AND (
            inventory_receipts.created_by = (select auth.uid()) OR
            EXISTS (
              SELECT 1 FROM public.employees
              WHERE employees.id = (select auth.uid())
              AND ('Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
            )
          )
        )
      )
  $policy$;
END $$;

-- =====================================================
-- 3. REMOVE UNUSED INDEXES
-- =====================================================

-- Drop unused indexes on master_inventory_items
DROP INDEX IF EXISTS public.idx_master_inventory_items_category;
DROP INDEX IF EXISTS public.idx_master_inventory_items_active;
DROP INDEX IF EXISTS public.idx_master_inventory_items_supplier;
DROP INDEX IF EXISTS public.idx_master_inventory_items_brand;

-- Drop unused indexes on store_inventory_stock
DROP INDEX IF EXISTS public.idx_store_inventory_stock_store_id;
DROP INDEX IF EXISTS public.idx_store_inventory_stock_item_id;

-- Drop unused indexes on end_of_day_records
DROP INDEX IF EXISTS public.idx_end_of_day_records_updated_by;

-- Drop unused indexes on ticket_items
DROP INDEX IF EXISTS public.idx_ticket_items_completed_by;

-- Drop unused indexes on suppliers
DROP INDEX IF EXISTS public.idx_suppliers_name;
DROP INDEX IF EXISTS public.idx_suppliers_code_prefix;

-- Drop unused indexes on employees
DROP INDEX IF EXISTS public.idx_employees_weekly_schedule;

-- Drop unused indexes on inventory_receipts
DROP INDEX IF EXISTS public.idx_inventory_receipts_store;
DROP INDEX IF EXISTS public.idx_inventory_receipts_status;
DROP INDEX IF EXISTS public.idx_inventory_receipts_recipient;
DROP INDEX IF EXISTS public.idx_inventory_receipts_created_by;

-- Drop unused indexes on inventory_receipt_items
DROP INDEX IF EXISTS public.idx_inventory_receipt_items_receipt;
DROP INDEX IF EXISTS public.idx_inventory_receipt_items_item;

-- Drop unused indexes on inventory_activity_log
DROP INDEX IF EXISTS public.idx_inventory_activity_store;
DROP INDEX IF EXISTS public.idx_inventory_activity_receipt;

-- Drop unused indexes on inventory_items_old
DROP INDEX IF EXISTS public.idx_inventory_items_stock;
DROP INDEX IF EXISTS public.idx_inventory_items_store;
DROP INDEX IF EXISTS public.idx_inventory_items_active;

-- Drop unused indexes on inventory_transactions
DROP INDEX IF EXISTS public.idx_inventory_transactions_requested_by;

-- Drop unused indexes on inventory_transaction_items
DROP INDEX IF EXISTS public.idx_inventory_transaction_items_transaction;
DROP INDEX IF EXISTS public.idx_inventory_transaction_items_item;

-- Drop unused indexes on sale_tickets
DROP INDEX IF EXISTS public.idx_sale_tickets_self_service;

-- =====================================================
-- 4. FIX MULTIPLE PERMISSIVE POLICIES
-- =====================================================

-- Fix stores table - remove duplicate policy
DROP POLICY IF EXISTS "Allow all access to stores" ON public.stores;

-- Fix suppliers table - remove one duplicate policy (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
    DROP POLICY IF EXISTS "Anyone can view active suppliers" ON public.suppliers;
  END IF;
END $$;

-- =====================================================
-- 5. REMOVE DUPLICATE INDEXES
-- =====================================================

-- Drop duplicate index on inventory_items_old
DROP INDEX IF EXISTS public.idx_inventory_items_store_id;

-- =====================================================
-- 6. FIX SECURITY DEFINER VIEW
-- =====================================================

-- Recreate inventory_items view without SECURITY DEFINER (only if tables exist)
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
      COALESCE(sis.unit_cost_override, mi.unit_cost) as unit_cost,
      COALESCE(sis.reorder_level_override, mi.reorder_level) as reorder_level,
      mi.is_active,
      sis.created_at,
      sis.updated_at,
      mi.id as master_item_id
    FROM public.store_inventory_stock sis
    JOIN public.master_inventory_items mi ON mi.id = sis.item_id
  $view$;

  GRANT SELECT ON public.inventory_items TO anon, authenticated;
END $$;

-- =====================================================
-- 7. FIX FUNCTION SEARCH PATH ISSUES
-- =====================================================

-- Drop existing functions before recreating with fixed search_path
DROP FUNCTION IF EXISTS public.check_opening_cash_recorded(uuid, date);
DROP FUNCTION IF EXISTS public.validate_weekly_schedule(jsonb);
DROP FUNCTION IF EXISTS public.get_sorted_technicians_for_store(uuid, text);

-- Recreate check_opening_cash_recorded with fixed search_path
CREATE FUNCTION public.check_opening_cash_recorded(
  p_store_id uuid,
  p_date date
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_opening_cash boolean;
BEGIN
  SELECT (
    (opening_cash_amount IS NOT NULL AND opening_cash_amount > 0) OR
    (bill_100 IS NOT NULL AND bill_100 > 0) OR
    (bill_50 IS NOT NULL AND bill_50 > 0) OR
    (bill_20 IS NOT NULL AND bill_20 > 0) OR
    (bill_10 IS NOT NULL AND bill_10 > 0) OR
    (bill_5 IS NOT NULL AND bill_5 > 0) OR
    (bill_2 IS NOT NULL AND bill_2 > 0) OR
    (bill_1 IS NOT NULL AND bill_1 > 0) OR
    (coin_25 IS NOT NULL AND coin_25 > 0) OR
    (coin_10 IS NOT NULL AND coin_10 > 0) OR
    (coin_5 IS NOT NULL AND coin_5 > 0)
  ) INTO v_has_opening_cash
  FROM public.end_of_day_records
  WHERE store_id = p_store_id
    AND date = p_date;

  RETURN COALESCE(v_has_opening_cash, false);
END;
$$;

-- Recreate validate_weekly_schedule with fixed search_path
CREATE FUNCTION public.validate_weekly_schedule(schedule jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

-- Recreate get_sorted_technicians_for_store with fixed search_path
CREATE FUNCTION public.get_sorted_technicians_for_store(
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
SECURITY DEFINER
SET search_path = public, pg_temp
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
