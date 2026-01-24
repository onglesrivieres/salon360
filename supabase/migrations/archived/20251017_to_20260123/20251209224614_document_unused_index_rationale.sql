/*
  # Document Unused Index Rationale

  ## Summary
  This migration documents why certain indexes are flagged as "unused" but should be retained.

  ## Unused Index Analysis

  ### Foreign Key Indexes (MUST RETAIN)
  The following indexes are on foreign key columns and are essential for:
  - JOIN query performance
  - DELETE CASCADE operations
  - Referential integrity constraint checks
  - Preventing table locks during foreign key validations

  These indexes will be utilized when JOIN queries are executed, even if they
  show as "unused" in current statistics.

  Foreign Key Indexes to Retain:
  - cash_transactions: created_by_id, manager_approved_by_id
  - employee_inventory: item_id
  - employee_inventory_lots: employee_id, item_id, lot_id, store_id
  - end_of_day_records: created_by, updated_by
  - inventory_activity_log: performed_by, receipt_id, store_id
  - inventory_approval_audit_log: employee_id, store_id, transaction_id
  - inventory_audit_items: audit_id, item_id
  - inventory_audits: employee_id, approved_by_id, audited_by_id
  - inventory_distributions: from_employee_id, to_employee_id, item_id, lot_id, store_id, distributed_by_id
  - inventory_purchase_lots: item_id, store_id, created_by_id
  - inventory_receipt_items: receipt_id
  - inventory_receipts: created_by, recipient_id, approved_by_management, approved_by_recipient, rejected_by
  - inventory_transaction_items: item_id, lot_id
  - inventory_transactions: requested_by_id, manager_approved_by_id, recipient_approved_by_id
  - store_product_preferences: item_id, last_used_purchase_unit_id, updated_by_id
  - store_product_purchase_units: item_id
  - ticket_items: completed_by

  ### Special Case Index
  - idx_approval_status_correction_audit_approved_by: This is on the approved_by
    column in the approval_status_correction_audit table. Retained for audit queries.

  ## Action Taken
  No indexes removed. All indexes serve important performance or referential integrity purposes.

  ## Note
  "Unused" status in pg_stat_user_indexes simply means the index hasn't been accessed
  by queries yet. This is expected for:
  1. Newly created indexes
  2. Tables with low query volume
  3. Indexes that optimize specific JOIN patterns not yet executed

  These indexes will be utilized when the application performs:
  - Multi-table JOINs
  - Foreign key constraint validations
  - DELETE operations with cascades
  - Complex queries involving related tables
*/

-- No changes needed - this migration is documentation only
SELECT 'All indexes retained for performance and referential integrity' as status;