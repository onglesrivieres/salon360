/*
  # Fix Remaining Security Issues

  ## 1. Add Missing Foreign Key Indexes (29 indexes)
    - cash_transactions: created_by_id, manager_approved_by_id
    - employee_inventory: item_id
    - employee_inventory_lots: employee_id, item_id, lot_id
    - end_of_day_records: updated_by
    - inventory_activity_log: receipt_id, store_id
    - inventory_approval_audit_log: employee_id, transaction_id
    - inventory_audit_items: audit_id, item_id
    - inventory_audits: employee_id
    - inventory_distributions: from_employee_id, item_id, lot_id, store_id, to_employee_id
    - inventory_purchase_lots: item_id, store_id
    - inventory_receipt_items: receipt_id
    - inventory_receipts: created_by, recipient_id
    - inventory_transaction_items: lot_id
    - inventory_transactions: requested_by_id
    - store_product_preferences: item_id
    - store_product_purchase_units: item_id
    - ticket_items: completed_by

  ## 2. Fix Function Search Paths
    - backfill_historical_auto_checkout
    - preview_historical_auto_checkout

  ## Note on Unused Indexes
    - Previously created indexes may show as unused initially
    - They will be used when relevant JOIN queries are executed
    - Foreign key indexes are critical for referential integrity performance
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- cash_transactions
CREATE INDEX IF NOT EXISTS idx_cash_transactions_created_by_id_fk 
  ON public.cash_transactions(created_by_id);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_manager_approved_by_id_fk 
  ON public.cash_transactions(manager_approved_by_id);

-- employee_inventory
CREATE INDEX IF NOT EXISTS idx_employee_inventory_item_id_fk 
  ON public.employee_inventory(item_id);

-- employee_inventory_lots
CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_employee_id_fk 
  ON public.employee_inventory_lots(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_item_id_fk 
  ON public.employee_inventory_lots(item_id);

CREATE INDEX IF NOT EXISTS idx_employee_inventory_lots_lot_id_fk 
  ON public.employee_inventory_lots(lot_id);

-- end_of_day_records
CREATE INDEX IF NOT EXISTS idx_end_of_day_records_updated_by_fk 
  ON public.end_of_day_records(updated_by);

-- inventory_activity_log
CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_receipt_id_fk 
  ON public.inventory_activity_log(receipt_id);

CREATE INDEX IF NOT EXISTS idx_inventory_activity_log_store_id_fk 
  ON public.inventory_activity_log(store_id);

-- inventory_approval_audit_log
CREATE INDEX IF NOT EXISTS idx_inventory_approval_audit_log_employee_id_fk 
  ON public.inventory_approval_audit_log(employee_id);

CREATE INDEX IF NOT EXISTS idx_inventory_approval_audit_log_transaction_id_fk 
  ON public.inventory_approval_audit_log(transaction_id);

-- inventory_audit_items
CREATE INDEX IF NOT EXISTS idx_inventory_audit_items_audit_id_fk 
  ON public.inventory_audit_items(audit_id);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_items_item_id_fk 
  ON public.inventory_audit_items(item_id);

-- inventory_audits
CREATE INDEX IF NOT EXISTS idx_inventory_audits_employee_id_fk 
  ON public.inventory_audits(employee_id);

-- inventory_distributions
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_from_employee_id_fk 
  ON public.inventory_distributions(from_employee_id);

CREATE INDEX IF NOT EXISTS idx_inventory_distributions_item_id_fk 
  ON public.inventory_distributions(item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_distributions_lot_id_fk 
  ON public.inventory_distributions(lot_id);

CREATE INDEX IF NOT EXISTS idx_inventory_distributions_store_id_fk 
  ON public.inventory_distributions(store_id);

CREATE INDEX IF NOT EXISTS idx_inventory_distributions_to_employee_id_fk 
  ON public.inventory_distributions(to_employee_id);

-- inventory_purchase_lots
CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_item_id_fk 
  ON public.inventory_purchase_lots(item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_purchase_lots_store_id_fk 
  ON public.inventory_purchase_lots(store_id);

-- inventory_receipt_items
CREATE INDEX IF NOT EXISTS idx_inventory_receipt_items_receipt_id_fk 
  ON public.inventory_receipt_items(receipt_id);

-- inventory_receipts
CREATE INDEX IF NOT EXISTS idx_inventory_receipts_created_by_fk 
  ON public.inventory_receipts(created_by);

CREATE INDEX IF NOT EXISTS idx_inventory_receipts_recipient_id_fk 
  ON public.inventory_receipts(recipient_id);

-- inventory_transaction_items
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_lot_id_fk 
  ON public.inventory_transaction_items(lot_id);

-- inventory_transactions
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_requested_by_id_fk 
  ON public.inventory_transactions(requested_by_id);

-- store_product_preferences
CREATE INDEX IF NOT EXISTS idx_store_product_preferences_item_id_fk 
  ON public.store_product_preferences(item_id);

-- store_product_purchase_units
CREATE INDEX IF NOT EXISTS idx_store_product_purchase_units_item_id_fk 
  ON public.store_product_purchase_units(item_id);

-- ticket_items
CREATE INDEX IF NOT EXISTS idx_ticket_items_completed_by_fk 
  ON public.ticket_items(completed_by);

-- =====================================================
-- 2. FIX FUNCTION SEARCH PATHS
-- =====================================================

-- These functions still show as having mutable search_path
-- Recreate them with explicit ALTER FUNCTION to set search_path

ALTER FUNCTION public.backfill_historical_auto_checkout() 
  SET search_path = public, pg_temp;

ALTER FUNCTION public.preview_historical_auto_checkout() 
  SET search_path = public, pg_temp;