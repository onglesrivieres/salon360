/*
  # Comprehensive Security and Performance Fixes

  ## 1. Add Missing Foreign Key Indexes
    - approval_status_correction_audit.approved_by
    - employee_inventory_lots.store_id
    - end_of_day_records.created_by
    - inventory_activity_log.performed_by
    - inventory_approval_audit_log.store_id
    - inventory_audits.approved_by_id, audited_by_id
    - inventory_distributions.distributed_by_id
    - inventory_purchase_lots.created_by_id
    - inventory_receipts.approved_by_management, approved_by_recipient, rejected_by
    - inventory_transaction_items.item_id
    - inventory_transactions.manager_approved_by_id, recipient_approved_by_id
    - store_product_preferences.last_used_purchase_unit_id, updated_by_id

  ## 2. Fix RLS Performance Issues
    - Update inventory_approval_audit_log policies to use (select auth.uid())

  ## 3. Remove Unused Indexes
    - Drop all unused indexes identified by Supabase advisor

  ## 4. Fix Duplicate Policies
    - Remove duplicate cash_transactions policies

  ## 5. Fix Function Search Paths
    - Set explicit search_path for functions with mutable search_path
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_approval_status_correction_audit_approved_by 
  ON public.approval_status_correction_audit(approved_by);

CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_store_id_fk 
  ON public.employee_inventory_lots(store_id);

CREATE INDEX IF NOT EXISTS idx_end_of_day_records_created_by_fk 
  ON public.end_of_day_records(created_by);

CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_performed_by_fk 
  ON public.inventory_activity_log(performed_by);

CREATE INDEX IF NOT EXISTS idx_inventory_approval_audit_log_store_id_fk 
  ON public.inventory_approval_audit_log(store_id);

CREATE INDEX IF NOT EXISTS idx_inventory_audits_approved_by_id_fk 
  ON public.inventory_audits(approved_by_id);

CREATE INDEX IF NOT EXISTS idx_inventory_audits_audited_by_id_fk 
  ON public.inventory_audits(audited_by_id);

CREATE INDEX IF NOT EXISTS idx_inventory_distributions_distributed_by_id_fk 
  ON public.inventory_distributions(distributed_by_id);

CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_created_by_id_fk 
  ON public.inventory_purchase_lots(created_by_id);

CREATE INDEX IF NOT EXISTS idx_inventory_receipts_approved_by_management_fk 
  ON public.inventory_receipts(approved_by_management);

CREATE INDEX IF NOT EXISTS idx_inventory_receipts_approved_by_recipient_fk 
  ON public.inventory_receipts(approved_by_recipient);

CREATE INDEX IF NOT EXISTS idx_inventory_receipts_rejected_by_fk 
  ON public.inventory_receipts(rejected_by);

CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_item_id_fk 
  ON public.inventory_transaction_items(item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_manager_approved_by_id_fk 
  ON public.inventory_transactions(manager_approved_by_id);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_recipient_approved_by_id_fk 
  ON public.inventory_transactions(recipient_approved_by_id);

CREATE INDEX IF NOT EXISTS idx_store_product_preferences_last_used_purchase_unit_id_fk 
  ON public.store_product_preferences(last_used_purchase_unit_id);

CREATE INDEX IF NOT EXISTS idx_store_product_preferences_updated_by_id_fk 
  ON public.store_product_preferences(updated_by_id);

-- =====================================================
-- 2. FIX RLS PERFORMANCE ISSUES
-- =====================================================

-- Drop and recreate inventory_approval_audit_log policies with optimized auth calls
DROP POLICY IF EXISTS "Managers can view audit records" ON public.inventory_approval_audit_log;
DROP POLICY IF EXISTS "Authenticated users can insert audit records" ON public.inventory_approval_audit_log;

CREATE POLICY "Managers can view audit records"
  ON public.inventory_approval_audit_log
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = (SELECT auth.uid())
      AND 'manager' = ANY(employees.role)
      AND employees.status = 'active'
    )
  );

CREATE POLICY "Authenticated users can insert audit records"
  ON public.inventory_approval_audit_log
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- =====================================================
-- 3. REMOVE UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS public.idx_end_of_day_records_updated_by;
DROP INDEX IF EXISTS public.idx_inventory_activity_log_receipt_id;
DROP INDEX IF EXISTS public.idx_inventory_activity_log_store_id;
DROP INDEX IF EXISTS public.idx_inventory_receipt_items_item_id;
DROP INDEX IF EXISTS public.idx_inventory_receipt_items_receipt_id;
DROP INDEX IF EXISTS public.idx_inventory_receipts_created_by;
DROP INDEX IF EXISTS public.idx_inventory_receipts_recipient_id;
DROP INDEX IF EXISTS public.idx_approval_correction_audit_timestamp;
DROP INDEX IF EXISTS public.idx_inventory_transactions_requested_by_id;
DROP INDEX IF EXISTS public.idx_ticket_items_completed_by;
DROP INDEX IF EXISTS public.idx_employee_inventory_store_id;
DROP INDEX IF EXISTS public.idx_cash_transactions_store_id;
DROP INDEX IF EXISTS public.idx_cash_transactions_date;
DROP INDEX IF EXISTS public.idx_cash_transactions_status;
DROP INDEX IF EXISTS public.idx_cash_transactions_transaction_type;
DROP INDEX IF EXISTS public.idx_cash_transactions_created_by;
DROP INDEX IF EXISTS public.idx_cash_transactions_approved_by;
DROP INDEX IF EXISTS public.idx_employee_inventory_lots_employee_id;
DROP INDEX IF EXISTS public.idx_employee_inventory_lots_lot_id;
DROP INDEX IF EXISTS public.idx_employee_inventory_employee_id;
DROP INDEX IF EXISTS public.idx_inventory_distributions_store_id;
DROP INDEX IF EXISTS public.idx_inventory_purchase_lots_store_id;
DROP INDEX IF EXISTS public.idx_inventory_purchase_lots_status;
DROP INDEX IF EXISTS public.idx_inventory_purchase_lots_purchase_date;
DROP INDEX IF EXISTS public.idx_inventory_purchase_lots_expiration_date;
DROP INDEX IF EXISTS public.idx_inventory_transaction_items_lot_id;
DROP INDEX IF EXISTS public.idx_inventory_distributions_lot_id;
DROP INDEX IF EXISTS public.idx_inventory_distributions_to_employee_id;
DROP INDEX IF EXISTS public.idx_inventory_distributions_from_employee_id;
DROP INDEX IF EXISTS public.idx_inventory_distributions_status;
DROP INDEX IF EXISTS public.idx_inventory_distributions_distribution_date;
DROP INDEX IF EXISTS public.idx_inventory_audits_employee_id;
DROP INDEX IF EXISTS public.idx_inventory_audits_audit_date;
DROP INDEX IF EXISTS public.idx_inventory_audits_status;
DROP INDEX IF EXISTS public.idx_inventory_audit_items_audit_id;
DROP INDEX IF EXISTS public.idx_store_product_preferences_last_used_at;
DROP INDEX IF EXISTS public.idx_store_product_purchase_units_store_id;
DROP INDEX IF EXISTS public.idx_inventory_transaction_items_purchase_unit_price;
DROP INDEX IF EXISTS public.idx_store_product_preferences_store_id;
DROP INDEX IF EXISTS public.idx_inventory_audit_log_employee;
DROP INDEX IF EXISTS public.idx_inventory_audit_log_transaction;
DROP INDEX IF EXISTS public.idx_inventory_audit_log_created_at;
DROP INDEX IF EXISTS public.idx_cash_transactions_type;
DROP INDEX IF EXISTS public.idx_inventory_purchase_lots_item_id;
DROP INDEX IF EXISTS public.idx_inventory_items_store_id;
DROP INDEX IF EXISTS public.idx_inventory_items_name;
DROP INDEX IF EXISTS public.idx_inventory_items_active;
DROP INDEX IF EXISTS public.idx_employee_inventory_item_id;
DROP INDEX IF EXISTS public.idx_employee_inventory_lots_item_id;
DROP INDEX IF EXISTS public.idx_inventory_distributions_item_id;
DROP INDEX IF EXISTS public.idx_inventory_audit_items_item_id;
DROP INDEX IF EXISTS public.idx_store_product_purchase_units_item_id;
DROP INDEX IF EXISTS public.idx_store_product_preferences_item_id;

-- =====================================================
-- 4. FIX DUPLICATE POLICIES ON CASH_TRANSACTIONS
-- =====================================================

-- Remove duplicate policies (keep the more descriptive ones)
DROP POLICY IF EXISTS "Allow all to create cash transactions" ON public.cash_transactions;
DROP POLICY IF EXISTS "Allow all to view cash transactions" ON public.cash_transactions;
DROP POLICY IF EXISTS "Allow all to update cash transactions" ON public.cash_transactions;

-- =====================================================
-- 5. FIX FUNCTION SEARCH PATHS
-- =====================================================

-- Drop and recreate functions with proper search_path

DROP FUNCTION IF EXISTS public.auto_checkout_employees_by_context();
CREATE FUNCTION public.auto_checkout_employees_by_context()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  store RECORD;
  current_time_at_store timestamptz;
  checkout_time timestamptz;
BEGIN
  FOR store IN 
    SELECT id, timezone, closing_time
    FROM public.stores
    WHERE closing_time IS NOT NULL
  LOOP
    current_time_at_store := now() AT TIME ZONE store.timezone;
    checkout_time := (current_date AT TIME ZONE store.timezone + store.closing_time) AT TIME ZONE store.timezone;
    
    IF current_time_at_store >= checkout_time THEN
      UPDATE public.attendance_records
      SET 
        check_out_time = checkout_time,
        updated_at = now()
      WHERE 
        store_id = store.id
        AND date = CURRENT_DATE
        AND check_out_time IS NULL;
    END IF;
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.backfill_historical_auto_checkout();
CREATE FUNCTION public.backfill_historical_auto_checkout()
RETURNS TABLE(
  records_updated bigint,
  store_id uuid,
  store_name text,
  affected_dates text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH updated_records AS (
    UPDATE public.attendance_records ar
    SET 
      check_out_time = (ar.date AT TIME ZONE s.timezone + s.closing_time) AT TIME ZONE s.timezone,
      updated_at = now()
    FROM public.stores s
    WHERE 
      ar.store_id = s.id
      AND s.closing_time IS NOT NULL
      AND ar.check_out_time IS NULL
      AND ar.date < CURRENT_DATE
    RETURNING ar.store_id, ar.date
  )
  SELECT 
    COUNT(*)::bigint as records_updated,
    ur.store_id,
    s.name as store_name,
    array_agg(DISTINCT ur.date::text ORDER BY ur.date::text) as affected_dates
  FROM updated_records ur
  JOIN public.stores s ON s.id = ur.store_id
  GROUP BY ur.store_id, s.name;
END;
$$;

DROP FUNCTION IF EXISTS public.preview_historical_auto_checkout();
CREATE FUNCTION public.preview_historical_auto_checkout()
RETURNS TABLE(
  records_to_update bigint,
  store_id uuid,
  store_name text,
  affected_dates text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as records_to_update,
    ar.store_id,
    s.name as store_name,
    array_agg(DISTINCT ar.date::text ORDER BY ar.date::text) as affected_dates
  FROM public.attendance_records ar
  JOIN public.stores s ON s.id = ar.store_id
  WHERE 
    s.closing_time IS NOT NULL
    AND ar.check_out_time IS NULL
    AND ar.date < CURRENT_DATE
  GROUP BY ar.store_id, s.name;
END;
$$;

DROP FUNCTION IF EXISTS public.get_approval_correction_diagnostics();
CREATE FUNCTION public.get_approval_correction_diagnostics()
RETURNS TABLE(
  total_tickets bigint,
  manually_approved_incorrectly bigint,
  auto_approved_correctly bigint,
  needs_correction bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_tickets,
    COUNT(*) FILTER (WHERE st.approval_status = 'manually_approved' AND st.requires_higher_approval = false)::bigint as manually_approved_incorrectly,
    COUNT(*) FILTER (WHERE st.approval_status = 'auto_approved' AND st.requires_higher_approval = false)::bigint as auto_approved_correctly,
    COUNT(*) FILTER (WHERE st.approval_status = 'manually_approved' AND st.requires_higher_approval = false)::bigint as needs_correction
  FROM public.sale_tickets st;
END;
$$;

DROP FUNCTION IF EXISTS public.verify_approval_corrections();
CREATE FUNCTION public.verify_approval_corrections()
RETURNS TABLE(
  ticket_id uuid,
  approval_status text,
  requires_higher_approval boolean,
  is_consistent boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id as ticket_id,
    st.approval_status,
    st.requires_higher_approval,
    CASE 
      WHEN st.requires_higher_approval = false AND st.approval_status = 'auto_approved' THEN true
      WHEN st.requires_higher_approval = true AND st.approval_status = 'manually_approved' THEN true
      ELSE false
    END as is_consistent
  FROM public.sale_tickets st
  WHERE st.status IN ('completed', 'closed');
END;
$$;

DROP FUNCTION IF EXISTS public.get_approval_correction_summary();
CREATE FUNCTION public.get_approval_correction_summary()
RETURNS TABLE(
  corrected_count bigint,
  correction_timestamp timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as corrected_count,
    MAX(corrected_at) as correction_timestamp
  FROM public.approval_status_correction_audit;
END;
$$;