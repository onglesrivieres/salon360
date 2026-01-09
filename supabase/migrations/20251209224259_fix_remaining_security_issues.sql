/*
  # Fix Remaining Security Issues

  ## 1. Add Missing Foreign Key Indexes (conditional)
    - Only creates indexes if the tables and columns exist

  ## 2. Fix Function Search Paths
    - backfill_historical_auto_checkout
    - preview_historical_auto_checkout
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES (conditional)
-- =====================================================

DO $$
BEGIN
  -- cash_transactions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_transactions') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cash_transactions' AND column_name = 'created_by_id') THEN
      CREATE INDEX IF NOT EXISTS idx_cash_transactions_created_by_id_fk ON public.cash_transactions(created_by_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cash_transactions' AND column_name = 'manager_approved_by_id') THEN
      CREATE INDEX IF NOT EXISTS idx_cash_transactions_manager_approved_by_id_fk ON public.cash_transactions(manager_approved_by_id);
    END IF;
  END IF;

  -- employee_inventory
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_inventory') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employee_inventory' AND column_name = 'item_id') THEN
      CREATE INDEX IF NOT EXISTS idx_employee_inventory_item_id_fk ON public.employee_inventory(item_id);
    END IF;
  END IF;

  -- employee_inventory_lots
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_inventory_lots') THEN
    CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_employee_id_fk ON public.employee_inventory_lots(employee_id);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employee_inventory_lots' AND column_name = 'item_id') THEN
      CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_item_id_fk ON public.employee_inventory_lots(item_id);
    END IF;
    CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_lot_id_fk ON public.employee_inventory_lots(lot_id);
  END IF;

  -- end_of_day_records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'end_of_day_records') THEN
    CREATE INDEX IF NOT EXISTS idx_end_of_day_records_updated_by_fk ON public.end_of_day_records(updated_by);
  END IF;

  -- inventory_activity_log
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_activity_log') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_receipt_id_fk ON public.inventory_activity_log(receipt_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_store_id_fk ON public.inventory_activity_log(store_id);
  END IF;

  -- inventory_approval_audit_log
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_approval_audit_log') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_approval_audit_log_employee_id_fk ON public.inventory_approval_audit_log(employee_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_approval_audit_log_transaction_id_fk ON public.inventory_approval_audit_log(transaction_id);
  END IF;

  -- inventory_audit_items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_audit_items') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_audit_items_audit_id_fk ON public.inventory_audit_items(audit_id);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_audit_items' AND column_name = 'item_id') THEN
      CREATE INDEX IF NOT EXISTS idx_inventory_audit_items_item_id_fk ON public.inventory_audit_items(item_id);
    END IF;
  END IF;

  -- inventory_audits
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_audits') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_audits_employee_id_fk ON public.inventory_audits(employee_id);
  END IF;

  -- inventory_distributions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_distributions') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_distributions_from_employee_id_fk ON public.inventory_distributions(from_employee_id);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_distributions' AND column_name = 'item_id') THEN
      CREATE INDEX IF NOT EXISTS idx_inventory_distributions_item_id_fk ON public.inventory_distributions(item_id);
    END IF;
    CREATE INDEX IF NOT EXISTS idx_inventory_distributions_lot_id_fk ON public.inventory_distributions(lot_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_distributions_store_id_fk ON public.inventory_distributions(store_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_distributions_to_employee_id_fk ON public.inventory_distributions(to_employee_id);
  END IF;

  -- inventory_purchase_lots
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_purchase_lots') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_purchase_lots' AND column_name = 'item_id') THEN
      CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_item_id_fk ON public.inventory_purchase_lots(item_id);
    END IF;
    CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_store_id_fk ON public.inventory_purchase_lots(store_id);
  END IF;

  -- inventory_receipt_items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_receipt_items') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_receipt_id_fk ON public.inventory_receipt_items(receipt_id);
  END IF;

  -- inventory_receipts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_receipts') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_receipts_created_by_fk ON public.inventory_receipts(created_by);
    CREATE INDEX IF NOT EXISTS idx_inventory_receipts_recipient_id_fk ON public.inventory_receipts(recipient_id);
  END IF;

  -- inventory_transaction_items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transaction_items') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_lot_id_fk ON public.inventory_transaction_items(lot_id);
  END IF;

  -- inventory_transactions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transactions') THEN
    CREATE INDEX IF NOT EXISTS idx_inventory_transactions_requested_by_id_fk ON public.inventory_transactions(requested_by_id);
  END IF;

  -- store_product_preferences
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_product_preferences') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_product_preferences' AND column_name = 'item_id') THEN
      CREATE INDEX IF NOT EXISTS idx_store_product_preferences_item_id_fk ON public.store_product_preferences(item_id);
    END IF;
  END IF;

  -- store_product_purchase_units
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'store_product_purchase_units') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_product_purchase_units' AND column_name = 'item_id') THEN
      CREATE INDEX IF NOT EXISTS idx_store_product_purchase_units_item_id_fk ON public.store_product_purchase_units(item_id);
    END IF;
  END IF;

  -- ticket_items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_items') THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_items_completed_by_fk ON public.ticket_items(completed_by);
  END IF;
END $$;

-- =====================================================
-- 2. FIX FUNCTION SEARCH PATHS (conditional)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'backfill_historical_auto_checkout' AND pronamespace = 'public'::regnamespace) THEN
    ALTER FUNCTION public.backfill_historical_auto_checkout() SET search_path = public, pg_temp;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'preview_historical_auto_checkout' AND pronamespace = 'public'::regnamespace) THEN
    ALTER FUNCTION public.preview_historical_auto_checkout() SET search_path = public, pg_temp;
  END IF;
END $$;
