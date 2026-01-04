/*
  # Fix Unindexed Foreign Keys

  1. Problem
    - Multiple tables have foreign keys without covering indexes
    - This can lead to suboptimal query performance, especially on DELETE/UPDATE operations
    
  2. Solution
    - Add indexes for all foreign key columns that don't have covering indexes
    
  3. Tables Affected
    - app_settings, app_settings_audit, cash_transaction_edit_history
    - cash_transactions, queue_removals_log, queue_violation_actions
    - queue_violation_reports, role_permissions_audit, safe_balance_history
*/

-- app_settings foreign key indexes
CREATE INDEX IF NOT EXISTS idx_app_settings_updated_by 
  ON public.app_settings(updated_by);

-- app_settings_audit foreign key indexes
CREATE INDEX IF NOT EXISTS idx_app_settings_audit_changed_by 
  ON public.app_settings_audit(changed_by);

-- cash_transaction_edit_history foreign key indexes
CREATE INDEX IF NOT EXISTS idx_cash_transaction_edit_history_edited_by 
  ON public.cash_transaction_edit_history(edited_by_id);

-- cash_transactions foreign key indexes
CREATE INDEX IF NOT EXISTS idx_cash_transactions_last_edited_by 
  ON public.cash_transactions(last_edited_by_id);

-- queue_removals_log foreign key indexes
CREATE INDEX IF NOT EXISTS idx_queue_removals_log_removed_by 
  ON public.queue_removals_log(removed_by_employee_id);

-- queue_violation_actions foreign key indexes
CREATE INDEX IF NOT EXISTS idx_queue_violation_actions_created_by 
  ON public.queue_violation_actions(created_by_employee_id);

-- queue_violation_reports foreign key indexes
CREATE INDEX IF NOT EXISTS idx_queue_violation_reports_reporter 
  ON public.queue_violation_reports(reporter_employee_id);

CREATE INDEX IF NOT EXISTS idx_queue_violation_reports_reviewed_by 
  ON public.queue_violation_reports(reviewed_by_employee_id);

-- role_permissions_audit foreign key indexes
CREATE INDEX IF NOT EXISTS idx_role_permissions_audit_changed_by 
  ON public.role_permissions_audit(changed_by);

-- safe_balance_history foreign key indexes
CREATE INDEX IF NOT EXISTS idx_safe_balance_history_created_by 
  ON public.safe_balance_history(created_by_id);

CREATE INDEX IF NOT EXISTS idx_safe_balance_history_updated_by 
  ON public.safe_balance_history(updated_by_id);

COMMENT ON INDEX idx_app_settings_updated_by IS 
'Improves performance of foreign key constraint checks and queries filtering by updated_by';

COMMENT ON INDEX idx_cash_transactions_last_edited_by IS 
'Improves performance of foreign key constraint checks and audit queries';

COMMENT ON INDEX idx_queue_removals_log_removed_by IS 
'Improves performance of queries filtering by removed_by_employee_id';

COMMENT ON INDEX idx_safe_balance_history_created_by IS 
'Improves performance of foreign key constraint checks and audit queries';
