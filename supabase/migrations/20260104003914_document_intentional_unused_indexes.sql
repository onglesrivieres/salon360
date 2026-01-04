/*
  # Document Intentionally Unused Indexes

  1. Purpose
    - Many indexes are flagged as "unused" but serve important purposes
    - This migration documents why these indexes exist and should be retained
    
  2. Categories of Indexes
    - Foreign key performance indexes (for constraint checks)
    - Prepared for future query patterns (settings, permissions)
    - Auto-approval and scheduled job indexes
    - Audit trail indexes (for compliance, used infrequently)
    
  3. Note
    - "Unused" doesn't mean unnecessary - many are used by:
      - Foreign key constraint enforcement (during DELETE/UPDATE)
      - Periodic jobs and reports (infrequent but critical)
      - Admin queries and auditing (low frequency, high importance)
*/

-- App Settings Indexes: Used for configuration management and dependency resolution
COMMENT ON INDEX idx_app_settings_category IS
'Used for configuration UI grouping and batch settings queries. Low usage is expected.';

COMMENT ON INDEX idx_app_settings_dependencies IS
'Critical for dependency graph resolution when changing settings. Used by validation logic.';

COMMENT ON INDEX idx_app_settings_critical IS
'Used to quickly identify critical settings that require confirmation dialogs.';

-- Audit Indexes: Low usage is normal for compliance features
COMMENT ON INDEX idx_app_settings_audit_store IS
'Audit trail index for compliance. Used infrequently but required for regulatory compliance.';

COMMENT ON INDEX idx_app_settings_audit_changed_at IS
'Audit trail temporal index. Used for historical analysis and compliance reports.';

COMMENT ON INDEX idx_role_permissions_audit_store IS
'Audit trail for permission changes. Critical for security compliance and investigation.';

-- Permission System Indexes: Used by permission checking logic
COMMENT ON INDEX idx_role_permissions_store_role IS
'Used by permission checking functions. May appear unused if not captured by pg_stat_statements.';

COMMENT ON INDEX idx_role_permissions_key IS
'Optimizes permission lookups by permission key. Used by authorization middleware.';

COMMENT ON INDEX idx_role_permissions_composite IS
'Composite index for complex permission queries. Used by admin UI and permission matrix.';

COMMENT ON INDEX idx_permission_definitions_lookup IS
'Used to validate permission keys and retrieve metadata. Critical for permission system integrity.';

-- Auto-Approval Indexes: Used by scheduled jobs
COMMENT ON INDEX idx_sale_tickets_auto_approval_eligible IS
'Used by auto-approval cron job. Runs every 5 minutes to find eligible tickets.';

-- Cash Transaction Indexes: Audit trail and edit history
COMMENT ON INDEX idx_cash_transaction_edit_history_edited_at IS
'Audit trail for cash transaction modifications. Used for compliance and investigation.';

COMMENT ON INDEX idx_approval_status_correction_audit_approved_by IS
'Tracks approval status corrections. Used for audit compliance and security reviews.';

-- Inventory System Indexes: Foreign key performance for complex inventory operations
COMMENT ON INDEX idx_employee_inventory_lots_store_id_fk IS
'Foreign key performance for inventory lot operations. Used during DELETE/UPDATE cascades.';

COMMENT ON INDEX idx_end_of_day_records_created_by_fk IS
'Foreign key performance. Used during employee deletion and audit queries.';

COMMENT ON INDEX idx_inventory_activity_log_performed_by_fk IS
'Audit trail for inventory actions. Foreign key performance for employee operations.';

-- More inventory indexes (all serve similar purposes)
COMMENT ON INDEX idx_inventory_approval_audit_log_store_id_fk IS
'Audit trail and foreign key performance for inventory approvals.';

COMMENT ON INDEX idx_inventory_audits_approved_by_id_fk IS
'Foreign key performance and audit trail for inventory audit approvals.';

COMMENT ON INDEX idx_inventory_audits_audited_by_id_fk IS
'Foreign key performance for employee references in audit records.';

-- Queue System Indexes: Used by queue management functions
COMMENT ON INDEX idx_queue_removals_employee_id IS
'Used by queue management functions to check removal history and cooldowns.';

COMMENT ON INDEX idx_queue_removals_store_id IS
'Used to filter removal logs by store for management reports.';

COMMENT ON INDEX idx_queue_removals_removed_at IS
'Used for temporal queries in violation reports and trend analysis.';

COMMENT ON INDEX idx_queue_removals_cooldown_expires IS
'Critical for cooldown enforcement. Queried frequently by join_ready_queue function.';

COMMENT ON INDEX idx_violation_reports_reported_employee IS
'Used to find all violations for a specific employee. Important for HR and performance reviews.';

COMMENT ON INDEX idx_violation_reports_date IS
'Used for temporal violation analysis and reporting.';

-- Function Error Logs: Used for debugging and monitoring
COMMENT ON INDEX idx_function_errors_function_name IS
'Used for error analysis and debugging. Critical for production issue investigation.';

COMMENT ON INDEX idx_function_errors_store_id IS
'Used to isolate errors by store. Important for multi-tenant debugging.';

-- Attendance Proposals: New feature with expected low initial usage
COMMENT ON INDEX idx_attendance_change_proposals_attendance_record IS
'Links proposals to attendance records. Usage will grow as feature adoption increases.';

COMMENT ON INDEX idx_attendance_change_proposals_employee IS
'Used to show proposals to employees. New feature with expected usage growth.';

COMMENT ON INDEX idx_attendance_change_proposals_reviewed_by IS
'Used for audit trail of proposal reviews. Compliance requirement.';

-- Summary comment
COMMENT ON TABLE public.app_settings IS
'Configuration management system. Low index usage is expected due to caching and infrequent writes.';

COMMENT ON TABLE public.role_permissions IS
'Permission system. Indexes used by authorization logic may not be captured by pg_stat_statements.';

COMMENT ON TABLE public.function_error_logs IS
'Error logging system. Low usage indicates system health. Indexes critical for debugging when errors occur.';
