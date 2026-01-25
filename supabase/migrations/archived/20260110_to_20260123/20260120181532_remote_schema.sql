drop trigger if exists "update_attendance_change_proposals_updated_at" on "public"."attendance_change_proposals";

drop trigger if exists "update_cash_transaction_change_proposals_updated_at" on "public"."cash_transaction_change_proposals";

drop trigger if exists "log_cash_transaction_edits" on "public"."cash_transactions";

drop trigger if exists "trigger_cash_transactions_updated_at" on "public"."cash_transactions";

drop trigger if exists "trigger_headquarter_deposit_transfer" on "public"."cash_transactions";

drop trigger if exists "validate_weekly_schedule_trigger" on "public"."employees";

drop trigger if exists "trg_calculate_closing_cash_amount" on "public"."end_of_day_records";

drop trigger if exists "trg_calculate_opening_cash_amount" on "public"."end_of_day_records";

drop trigger if exists "trigger_update_lot_status" on "public"."inventory_purchase_lots";

drop trigger if exists "trg_auto_approve_inventory" on "public"."inventory_transactions";

drop trigger if exists "trigger_create_lots_from_approved_transaction" on "public"."inventory_transactions";

drop trigger if exists "trigger_update_inventory_on_approval" on "public"."inventory_transactions";

drop trigger if exists "trigger_log_permission_changes" on "public"."role_permissions";

drop trigger if exists "trigger_update_role_permissions_timestamp" on "public"."role_permissions";

drop trigger if exists "trigger_safe_balance_history_updated_at" on "public"."safe_balance_history";

drop trigger if exists "auto_set_completed_at_trigger" on "public"."sale_tickets";

drop trigger if exists "enforce_no_previous_unclosed_tickets" on "public"."sale_tickets";

drop trigger if exists "ensure_approval_status_consistency" on "public"."sale_tickets";

drop trigger if exists "ensure_opening_cash_before_ticket" on "public"."sale_tickets";

drop trigger if exists "on_ticket_delete_update_queue" on "public"."sale_tickets";

drop trigger if exists "sale_tickets_mark_available" on "public"."sale_tickets";

drop trigger if exists "trigger_set_approval_deadline" on "public"."sale_tickets";

drop trigger if exists "trigger_ensure_single_default_purchase_unit" on "public"."store_product_purchase_units";

drop trigger if exists "trigger_store_service_categories_updated_at" on "public"."store_service_categories";

drop trigger if exists "ticket_items_auto_complete_previous" on "public"."ticket_items";

drop trigger if exists "ticket_items_mark_busy" on "public"."ticket_items";

drop trigger if exists "ticket_items_mark_busy_on_update" on "public"."ticket_items";

drop trigger if exists "trigger_auto_populate_started_at" on "public"."ticket_items";

drop policy "Admins can delete versions" on "public"."app_versions";

drop policy "Admins can insert versions" on "public"."app_versions";

drop policy "Admins can update versions" on "public"."app_versions";

drop policy "Users can create comments in their store" on "public"."attendance_comments";

drop policy "Users can view comments in their store" on "public"."attendance_comments";

drop policy "Managers and above can view auto-approval runs" on "public"."auto_approval_runs";

drop policy "Users can view edit history for their store" on "public"."cash_transaction_edit_history";

drop policy "Employees can only create transactions for assigned stores" on "public"."cash_transactions";

drop policy "Managers can view audit records" on "public"."inventory_approval_audit_log";

drop policy "Employees and management can view removal records" on "public"."queue_removals_log";

drop policy "Management can create removal records" on "public"."queue_removals_log";

drop policy "Employees can create reports" on "public"."queue_violation_reports";

drop policy "Admin and Owner can insert role permissions" on "public"."role_permissions";

drop policy "Admin and Owner can update role permissions" on "public"."role_permissions";

drop policy "Users can read role permissions for their stores" on "public"."role_permissions";

drop policy "Users can read audit logs for their stores" on "public"."role_permissions_audit";

drop policy "Admin, Manager, Supervisor, Owner can insert services" on "public"."services";

drop policy "Admin, Manager, Supervisor, Owner can update services" on "public"."services";

drop policy "Only Admin can delete services" on "public"."services";

drop policy "Admin, Manager, Supervisor can manage store services" on "public"."store_services";

drop policy "Admins can manage stores" on "public"."stores";

alter table "public"."app_settings" drop constraint "app_settings_store_id_fkey";

alter table "public"."app_settings" drop constraint "app_settings_updated_by_fkey";

alter table "public"."app_settings_audit" drop constraint "app_settings_audit_changed_by_fkey";

alter table "public"."app_settings_audit" drop constraint "app_settings_audit_store_id_fkey";

alter table "public"."approval_status_correction_audit" drop constraint "approval_status_correction_audit_approved_by_fkey";

alter table "public"."approval_status_correction_audit" drop constraint "approval_status_correction_audit_ticket_id_fkey";

alter table "public"."attendance_change_proposals" drop constraint "attendance_change_proposals_attendance_record_id_fkey";

alter table "public"."attendance_change_proposals" drop constraint "attendance_change_proposals_employee_id_fkey";

alter table "public"."attendance_change_proposals" drop constraint "attendance_change_proposals_reviewed_by_employee_id_fkey";

alter table "public"."attendance_comments" drop constraint "attendance_comments_attendance_record_id_fkey";

alter table "public"."attendance_comments" drop constraint "attendance_comments_employee_id_fkey";

alter table "public"."attendance_records" drop constraint "attendance_records_employee_id_fkey";

alter table "public"."attendance_records" drop constraint "attendance_records_store_id_fkey";

alter table "public"."cash_transaction_change_proposals" drop constraint "cash_transaction_change_proposals_cash_transaction_id_fkey";

alter table "public"."cash_transaction_change_proposals" drop constraint "cash_transaction_change_proposals_created_by_employee_id_fkey";

alter table "public"."cash_transaction_change_proposals" drop constraint "cash_transaction_change_proposals_reviewed_by_employee_id_fkey";

alter table "public"."cash_transaction_change_proposals" drop constraint "cash_transaction_change_proposals_store_id_fkey";

alter table "public"."cash_transaction_edit_history" drop constraint "cash_transaction_edit_history_edited_by_id_fkey";

alter table "public"."cash_transaction_edit_history" drop constraint "cash_transaction_edit_history_transaction_id_fkey";

alter table "public"."cash_transactions" drop constraint "cash_transactions_created_by_id_fkey";

alter table "public"."cash_transactions" drop constraint "cash_transactions_last_edited_by_id_fkey";

alter table "public"."cash_transactions" drop constraint "cash_transactions_manager_approved_by_id_fkey";

alter table "public"."cash_transactions" drop constraint "cash_transactions_store_id_fkey";

alter table "public"."client_color_history" drop constraint "client_color_history_client_id_fkey";

alter table "public"."client_color_history" drop constraint "client_color_history_ticket_id_fkey";

alter table "public"."clients" drop constraint "clients_blacklisted_by_fkey";

alter table "public"."clients" drop constraint "clients_store_id_fkey";

alter table "public"."employee_inventory" drop constraint "employee_inventory_employee_id_fkey";

alter table "public"."employee_inventory" drop constraint "employee_inventory_store_id_fkey";

alter table "public"."employee_inventory_lots" drop constraint "employee_inventory_lots_employee_id_fkey";

alter table "public"."employee_inventory_lots" drop constraint "employee_inventory_lots_lot_id_fkey";

alter table "public"."employee_inventory_lots" drop constraint "employee_inventory_lots_store_id_fkey";

alter table "public"."employee_services" drop constraint "employee_services_employee_id_fkey";

alter table "public"."employee_services" drop constraint "employee_services_service_id_fkey";

alter table "public"."employee_stores" drop constraint "employee_stores_employee_id_fkey";

alter table "public"."employee_stores" drop constraint "employee_stores_store_id_fkey";

alter table "public"."employees" drop constraint "employees_store_id_fkey";

alter table "public"."end_of_day_records" drop constraint "end_of_day_records_created_by_fkey";

alter table "public"."end_of_day_records" drop constraint "end_of_day_records_store_id_fkey";

alter table "public"."end_of_day_records" drop constraint "end_of_day_records_updated_by_fkey";

alter table "public"."inventory_approval_audit_log" drop constraint "inventory_approval_audit_log_employee_id_fkey";

alter table "public"."inventory_approval_audit_log" drop constraint "inventory_approval_audit_log_store_id_fkey";

alter table "public"."inventory_approval_audit_log" drop constraint "inventory_approval_audit_log_transaction_id_fkey";

alter table "public"."inventory_audit_items" drop constraint "inventory_audit_items_audit_id_fkey";

alter table "public"."inventory_audits" drop constraint "inventory_audits_approved_by_id_fkey";

alter table "public"."inventory_audits" drop constraint "inventory_audits_audited_by_id_fkey";

alter table "public"."inventory_audits" drop constraint "inventory_audits_employee_id_fkey";

alter table "public"."inventory_audits" drop constraint "inventory_audits_store_id_fkey";

alter table "public"."inventory_distributions" drop constraint "inventory_distributions_distributed_by_id_fkey";

alter table "public"."inventory_distributions" drop constraint "inventory_distributions_from_employee_id_fkey";

alter table "public"."inventory_distributions" drop constraint "inventory_distributions_lot_id_fkey";

alter table "public"."inventory_distributions" drop constraint "inventory_distributions_store_id_fkey";

alter table "public"."inventory_distributions" drop constraint "inventory_distributions_to_employee_id_fkey";

alter table "public"."inventory_items" drop constraint "inventory_items_store_id_fkey1";

alter table "public"."inventory_purchase_lots" drop constraint "inventory_purchase_lots_created_by_id_fkey";

alter table "public"."inventory_purchase_lots" drop constraint "inventory_purchase_lots_store_id_fkey";

alter table "public"."inventory_transaction_items" drop constraint "inventory_transaction_items_lot_id_fkey";

alter table "public"."inventory_transaction_items" drop constraint "inventory_transaction_items_purchase_unit_id_fkey";

alter table "public"."inventory_transaction_items" drop constraint "inventory_transaction_items_transaction_id_fkey";

alter table "public"."inventory_transactions" drop constraint "inventory_transactions_manager_approved_by_id_fkey";

alter table "public"."inventory_transactions" drop constraint "inventory_transactions_recipient_approved_by_id_fkey";

alter table "public"."inventory_transactions" drop constraint "inventory_transactions_recipient_id_fkey";

alter table "public"."inventory_transactions" drop constraint "inventory_transactions_requested_by_id_fkey";

alter table "public"."inventory_transactions" drop constraint "inventory_transactions_store_id_fkey";

alter table "public"."queue_removals_log" drop constraint "queue_removals_log_employee_id_fkey";

alter table "public"."queue_removals_log" drop constraint "queue_removals_log_removed_by_employee_id_fkey";

alter table "public"."queue_removals_log" drop constraint "queue_removals_log_store_id_fkey";

alter table "public"."queue_violation_actions" drop constraint "queue_violation_actions_created_by_employee_id_fkey";

alter table "public"."queue_violation_actions" drop constraint "queue_violation_actions_violation_report_id_fkey";

alter table "public"."queue_violation_reports" drop constraint "queue_violation_reports_reported_employee_id_fkey";

alter table "public"."queue_violation_reports" drop constraint "queue_violation_reports_reporter_employee_id_fkey";

alter table "public"."queue_violation_reports" drop constraint "queue_violation_reports_reviewed_by_employee_id_fkey";

alter table "public"."queue_violation_reports" drop constraint "queue_violation_reports_store_id_fkey";

alter table "public"."queue_violation_responses" drop constraint "queue_violation_responses_employee_id_fkey";

alter table "public"."queue_violation_responses" drop constraint "queue_violation_responses_violation_report_id_fkey";

alter table "public"."role_permissions" drop constraint "role_permissions_created_by_fkey";

alter table "public"."role_permissions" drop constraint "role_permissions_permission_key_fkey";

alter table "public"."role_permissions" drop constraint "role_permissions_store_id_fkey";

alter table "public"."role_permissions" drop constraint "role_permissions_updated_by_fkey";

alter table "public"."role_permissions_audit" drop constraint "role_permissions_audit_changed_by_fkey";

alter table "public"."role_permissions_audit" drop constraint "role_permissions_audit_store_id_fkey";

alter table "public"."safe_balance_history" drop constraint "safe_balance_history_created_by_id_fkey";

alter table "public"."safe_balance_history" drop constraint "safe_balance_history_store_id_fkey";

alter table "public"."safe_balance_history" drop constraint "safe_balance_history_updated_by_id_fkey";

alter table "public"."sale_tickets" drop constraint "sale_tickets_approval_performer_id_fkey";

alter table "public"."sale_tickets" drop constraint "sale_tickets_approved_by_fkey";

alter table "public"."sale_tickets" drop constraint "sale_tickets_client_id_fkey";

alter table "public"."sale_tickets" drop constraint "sale_tickets_closed_by_fkey";

alter table "public"."sale_tickets" drop constraint "sale_tickets_completed_by_fkey";

alter table "public"."sale_tickets" drop constraint "sale_tickets_created_by_fkey";

alter table "public"."sale_tickets" drop constraint "sale_tickets_saved_by_fkey";

alter table "public"."sale_tickets" drop constraint "sale_tickets_store_id_fkey";

alter table "public"."store_product_preferences" drop constraint "store_product_preferences_last_used_purchase_unit_id_fkey";

alter table "public"."store_product_preferences" drop constraint "store_product_preferences_store_id_fkey";

alter table "public"."store_product_preferences" drop constraint "store_product_preferences_updated_by_id_fkey";

alter table "public"."store_product_purchase_units" drop constraint "store_product_purchase_units_store_id_fkey";

alter table "public"."store_service_categories" drop constraint "store_service_categories_store_id_fkey";

alter table "public"."store_services" drop constraint "store_services_service_id_fkey";

alter table "public"."store_services" drop constraint "store_services_store_id_fkey";

alter table "public"."technician_ready_queue" drop constraint "technician_ready_queue_current_open_ticket_id_fkey";

alter table "public"."technician_ready_queue" drop constraint "technician_ready_queue_employee_id_fkey";

alter table "public"."technician_ready_queue" drop constraint "technician_ready_queue_store_id_fkey";

alter table "public"."ticket_activity_log" drop constraint "ticket_activity_log_employee_id_fkey";

alter table "public"."ticket_activity_log" drop constraint "ticket_activity_log_ticket_id_fkey";

alter table "public"."ticket_items" drop constraint "ticket_items_completed_by_fkey";

alter table "public"."ticket_items" drop constraint "ticket_items_employee_id_fkey";

alter table "public"."ticket_items" drop constraint "ticket_items_sale_ticket_id_fkey";

alter table "public"."ticket_items" drop constraint "ticket_items_store_service_id_fkey";

alter table "public"."app_settings" add constraint "app_settings_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."app_settings" validate constraint "app_settings_store_id_fkey";

alter table "public"."app_settings" add constraint "app_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.employees(id) not valid;

alter table "public"."app_settings" validate constraint "app_settings_updated_by_fkey";

alter table "public"."app_settings_audit" add constraint "app_settings_audit_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES public.employees(id) not valid;

alter table "public"."app_settings_audit" validate constraint "app_settings_audit_changed_by_fkey";

alter table "public"."app_settings_audit" add constraint "app_settings_audit_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."app_settings_audit" validate constraint "app_settings_audit_store_id_fkey";

alter table "public"."approval_status_correction_audit" add constraint "approval_status_correction_audit_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES public.employees(id) not valid;

alter table "public"."approval_status_correction_audit" validate constraint "approval_status_correction_audit_approved_by_fkey";

alter table "public"."approval_status_correction_audit" add constraint "approval_status_correction_audit_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.sale_tickets(id) ON DELETE CASCADE not valid;

alter table "public"."approval_status_correction_audit" validate constraint "approval_status_correction_audit_ticket_id_fkey";

alter table "public"."attendance_change_proposals" add constraint "attendance_change_proposals_attendance_record_id_fkey" FOREIGN KEY (attendance_record_id) REFERENCES public.attendance_records(id) ON DELETE CASCADE not valid;

alter table "public"."attendance_change_proposals" validate constraint "attendance_change_proposals_attendance_record_id_fkey";

alter table "public"."attendance_change_proposals" add constraint "attendance_change_proposals_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."attendance_change_proposals" validate constraint "attendance_change_proposals_employee_id_fkey";

alter table "public"."attendance_change_proposals" add constraint "attendance_change_proposals_reviewed_by_employee_id_fkey" FOREIGN KEY (reviewed_by_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."attendance_change_proposals" validate constraint "attendance_change_proposals_reviewed_by_employee_id_fkey";

alter table "public"."attendance_comments" add constraint "attendance_comments_attendance_record_id_fkey" FOREIGN KEY (attendance_record_id) REFERENCES public.attendance_records(id) ON DELETE CASCADE not valid;

alter table "public"."attendance_comments" validate constraint "attendance_comments_attendance_record_id_fkey";

alter table "public"."attendance_comments" add constraint "attendance_comments_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."attendance_comments" validate constraint "attendance_comments_employee_id_fkey";

alter table "public"."attendance_records" add constraint "attendance_records_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."attendance_records" validate constraint "attendance_records_employee_id_fkey";

alter table "public"."attendance_records" add constraint "attendance_records_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."attendance_records" validate constraint "attendance_records_store_id_fkey";

alter table "public"."cash_transaction_change_proposals" add constraint "cash_transaction_change_proposals_cash_transaction_id_fkey" FOREIGN KEY (cash_transaction_id) REFERENCES public.cash_transactions(id) ON DELETE CASCADE not valid;

alter table "public"."cash_transaction_change_proposals" validate constraint "cash_transaction_change_proposals_cash_transaction_id_fkey";

alter table "public"."cash_transaction_change_proposals" add constraint "cash_transaction_change_proposals_created_by_employee_id_fkey" FOREIGN KEY (created_by_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."cash_transaction_change_proposals" validate constraint "cash_transaction_change_proposals_created_by_employee_id_fkey";

alter table "public"."cash_transaction_change_proposals" add constraint "cash_transaction_change_proposals_reviewed_by_employee_id_fkey" FOREIGN KEY (reviewed_by_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."cash_transaction_change_proposals" validate constraint "cash_transaction_change_proposals_reviewed_by_employee_id_fkey";

alter table "public"."cash_transaction_change_proposals" add constraint "cash_transaction_change_proposals_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."cash_transaction_change_proposals" validate constraint "cash_transaction_change_proposals_store_id_fkey";

alter table "public"."cash_transaction_edit_history" add constraint "cash_transaction_edit_history_edited_by_id_fkey" FOREIGN KEY (edited_by_id) REFERENCES public.employees(id) not valid;

alter table "public"."cash_transaction_edit_history" validate constraint "cash_transaction_edit_history_edited_by_id_fkey";

alter table "public"."cash_transaction_edit_history" add constraint "cash_transaction_edit_history_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES public.cash_transactions(id) ON DELETE CASCADE not valid;

alter table "public"."cash_transaction_edit_history" validate constraint "cash_transaction_edit_history_transaction_id_fkey";

alter table "public"."cash_transactions" add constraint "cash_transactions_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."cash_transactions" validate constraint "cash_transactions_created_by_id_fkey";

alter table "public"."cash_transactions" add constraint "cash_transactions_last_edited_by_id_fkey" FOREIGN KEY (last_edited_by_id) REFERENCES public.employees(id) not valid;

alter table "public"."cash_transactions" validate constraint "cash_transactions_last_edited_by_id_fkey";

alter table "public"."cash_transactions" add constraint "cash_transactions_manager_approved_by_id_fkey" FOREIGN KEY (manager_approved_by_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."cash_transactions" validate constraint "cash_transactions_manager_approved_by_id_fkey";

alter table "public"."cash_transactions" add constraint "cash_transactions_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."cash_transactions" validate constraint "cash_transactions_store_id_fkey";

alter table "public"."client_color_history" add constraint "client_color_history_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE not valid;

alter table "public"."client_color_history" validate constraint "client_color_history_client_id_fkey";

alter table "public"."client_color_history" add constraint "client_color_history_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.sale_tickets(id) ON DELETE SET NULL not valid;

alter table "public"."client_color_history" validate constraint "client_color_history_ticket_id_fkey";

alter table "public"."clients" add constraint "clients_blacklisted_by_fkey" FOREIGN KEY (blacklisted_by) REFERENCES public.employees(id) not valid;

alter table "public"."clients" validate constraint "clients_blacklisted_by_fkey";

alter table "public"."clients" add constraint "clients_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."clients" validate constraint "clients_store_id_fkey";

alter table "public"."employee_inventory" add constraint "employee_inventory_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."employee_inventory" validate constraint "employee_inventory_employee_id_fkey";

alter table "public"."employee_inventory" add constraint "employee_inventory_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."employee_inventory" validate constraint "employee_inventory_store_id_fkey";

alter table "public"."employee_inventory_lots" add constraint "employee_inventory_lots_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."employee_inventory_lots" validate constraint "employee_inventory_lots_employee_id_fkey";

alter table "public"."employee_inventory_lots" add constraint "employee_inventory_lots_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.inventory_purchase_lots(id) ON DELETE RESTRICT not valid;

alter table "public"."employee_inventory_lots" validate constraint "employee_inventory_lots_lot_id_fkey";

alter table "public"."employee_inventory_lots" add constraint "employee_inventory_lots_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."employee_inventory_lots" validate constraint "employee_inventory_lots_store_id_fkey";

alter table "public"."employee_services" add constraint "employee_services_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."employee_services" validate constraint "employee_services_employee_id_fkey";

alter table "public"."employee_services" add constraint "employee_services_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE not valid;

alter table "public"."employee_services" validate constraint "employee_services_service_id_fkey";

alter table "public"."employee_stores" add constraint "employee_stores_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."employee_stores" validate constraint "employee_stores_employee_id_fkey";

alter table "public"."employee_stores" add constraint "employee_stores_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."employee_stores" validate constraint "employee_stores_store_id_fkey";

alter table "public"."employees" add constraint "employees_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."employees" validate constraint "employees_store_id_fkey";

alter table "public"."end_of_day_records" add constraint "end_of_day_records_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.employees(id) not valid;

alter table "public"."end_of_day_records" validate constraint "end_of_day_records_created_by_fkey";

alter table "public"."end_of_day_records" add constraint "end_of_day_records_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."end_of_day_records" validate constraint "end_of_day_records_store_id_fkey";

alter table "public"."end_of_day_records" add constraint "end_of_day_records_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.employees(id) not valid;

alter table "public"."end_of_day_records" validate constraint "end_of_day_records_updated_by_fkey";

alter table "public"."inventory_approval_audit_log" add constraint "inventory_approval_audit_log_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_approval_audit_log" validate constraint "inventory_approval_audit_log_employee_id_fkey";

alter table "public"."inventory_approval_audit_log" add constraint "inventory_approval_audit_log_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_approval_audit_log" validate constraint "inventory_approval_audit_log_store_id_fkey";

alter table "public"."inventory_approval_audit_log" add constraint "inventory_approval_audit_log_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES public.inventory_transactions(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_approval_audit_log" validate constraint "inventory_approval_audit_log_transaction_id_fkey";

alter table "public"."inventory_audit_items" add constraint "inventory_audit_items_audit_id_fkey" FOREIGN KEY (audit_id) REFERENCES public.inventory_audits(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_audit_items" validate constraint "inventory_audit_items_audit_id_fkey";

alter table "public"."inventory_audits" add constraint "inventory_audits_approved_by_id_fkey" FOREIGN KEY (approved_by_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_audits" validate constraint "inventory_audits_approved_by_id_fkey";

alter table "public"."inventory_audits" add constraint "inventory_audits_audited_by_id_fkey" FOREIGN KEY (audited_by_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_audits" validate constraint "inventory_audits_audited_by_id_fkey";

alter table "public"."inventory_audits" add constraint "inventory_audits_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_audits" validate constraint "inventory_audits_employee_id_fkey";

alter table "public"."inventory_audits" add constraint "inventory_audits_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_audits" validate constraint "inventory_audits_store_id_fkey";

alter table "public"."inventory_distributions" add constraint "inventory_distributions_distributed_by_id_fkey" FOREIGN KEY (distributed_by_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_distributions" validate constraint "inventory_distributions_distributed_by_id_fkey";

alter table "public"."inventory_distributions" add constraint "inventory_distributions_from_employee_id_fkey" FOREIGN KEY (from_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_distributions" validate constraint "inventory_distributions_from_employee_id_fkey";

alter table "public"."inventory_distributions" add constraint "inventory_distributions_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.inventory_purchase_lots(id) ON DELETE RESTRICT not valid;

alter table "public"."inventory_distributions" validate constraint "inventory_distributions_lot_id_fkey";

alter table "public"."inventory_distributions" add constraint "inventory_distributions_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_distributions" validate constraint "inventory_distributions_store_id_fkey";

alter table "public"."inventory_distributions" add constraint "inventory_distributions_to_employee_id_fkey" FOREIGN KEY (to_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_distributions" validate constraint "inventory_distributions_to_employee_id_fkey";

alter table "public"."inventory_items" add constraint "inventory_items_store_id_fkey1" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_items" validate constraint "inventory_items_store_id_fkey1";

alter table "public"."inventory_purchase_lots" add constraint "inventory_purchase_lots_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_purchase_lots" validate constraint "inventory_purchase_lots_created_by_id_fkey";

alter table "public"."inventory_purchase_lots" add constraint "inventory_purchase_lots_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_purchase_lots" validate constraint "inventory_purchase_lots_store_id_fkey";

alter table "public"."inventory_transaction_items" add constraint "inventory_transaction_items_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.inventory_purchase_lots(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_transaction_items" validate constraint "inventory_transaction_items_lot_id_fkey";

alter table "public"."inventory_transaction_items" add constraint "inventory_transaction_items_purchase_unit_id_fkey" FOREIGN KEY (purchase_unit_id) REFERENCES public.store_product_purchase_units(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_transaction_items" validate constraint "inventory_transaction_items_purchase_unit_id_fkey";

alter table "public"."inventory_transaction_items" add constraint "inventory_transaction_items_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES public.inventory_transactions(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_transaction_items" validate constraint "inventory_transaction_items_transaction_id_fkey";

alter table "public"."inventory_transactions" add constraint "inventory_transactions_manager_approved_by_id_fkey" FOREIGN KEY (manager_approved_by_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_transactions" validate constraint "inventory_transactions_manager_approved_by_id_fkey";

alter table "public"."inventory_transactions" add constraint "inventory_transactions_recipient_approved_by_id_fkey" FOREIGN KEY (recipient_approved_by_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_transactions" validate constraint "inventory_transactions_recipient_approved_by_id_fkey";

alter table "public"."inventory_transactions" add constraint "inventory_transactions_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES public.employees(id) ON DELETE RESTRICT not valid;

alter table "public"."inventory_transactions" validate constraint "inventory_transactions_recipient_id_fkey";

alter table "public"."inventory_transactions" add constraint "inventory_transactions_requested_by_id_fkey" FOREIGN KEY (requested_by_id) REFERENCES public.employees(id) ON DELETE RESTRICT not valid;

alter table "public"."inventory_transactions" validate constraint "inventory_transactions_requested_by_id_fkey";

alter table "public"."inventory_transactions" add constraint "inventory_transactions_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_transactions" validate constraint "inventory_transactions_store_id_fkey";

alter table "public"."queue_removals_log" add constraint "queue_removals_log_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."queue_removals_log" validate constraint "queue_removals_log_employee_id_fkey";

alter table "public"."queue_removals_log" add constraint "queue_removals_log_removed_by_employee_id_fkey" FOREIGN KEY (removed_by_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."queue_removals_log" validate constraint "queue_removals_log_removed_by_employee_id_fkey";

alter table "public"."queue_removals_log" add constraint "queue_removals_log_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."queue_removals_log" validate constraint "queue_removals_log_store_id_fkey";

alter table "public"."queue_violation_actions" add constraint "queue_violation_actions_created_by_employee_id_fkey" FOREIGN KEY (created_by_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."queue_violation_actions" validate constraint "queue_violation_actions_created_by_employee_id_fkey";

alter table "public"."queue_violation_actions" add constraint "queue_violation_actions_violation_report_id_fkey" FOREIGN KEY (violation_report_id) REFERENCES public.queue_violation_reports(id) ON DELETE CASCADE not valid;

alter table "public"."queue_violation_actions" validate constraint "queue_violation_actions_violation_report_id_fkey";

alter table "public"."queue_violation_reports" add constraint "queue_violation_reports_reported_employee_id_fkey" FOREIGN KEY (reported_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."queue_violation_reports" validate constraint "queue_violation_reports_reported_employee_id_fkey";

alter table "public"."queue_violation_reports" add constraint "queue_violation_reports_reporter_employee_id_fkey" FOREIGN KEY (reporter_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."queue_violation_reports" validate constraint "queue_violation_reports_reporter_employee_id_fkey";

alter table "public"."queue_violation_reports" add constraint "queue_violation_reports_reviewed_by_employee_id_fkey" FOREIGN KEY (reviewed_by_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."queue_violation_reports" validate constraint "queue_violation_reports_reviewed_by_employee_id_fkey";

alter table "public"."queue_violation_reports" add constraint "queue_violation_reports_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."queue_violation_reports" validate constraint "queue_violation_reports_store_id_fkey";

alter table "public"."queue_violation_responses" add constraint "queue_violation_responses_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."queue_violation_responses" validate constraint "queue_violation_responses_employee_id_fkey";

alter table "public"."queue_violation_responses" add constraint "queue_violation_responses_violation_report_id_fkey" FOREIGN KEY (violation_report_id) REFERENCES public.queue_violation_reports(id) ON DELETE CASCADE not valid;

alter table "public"."queue_violation_responses" validate constraint "queue_violation_responses_violation_report_id_fkey";

alter table "public"."role_permissions" add constraint "role_permissions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.employees(id) not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_created_by_fkey";

alter table "public"."role_permissions" add constraint "role_permissions_permission_key_fkey" FOREIGN KEY (permission_key) REFERENCES public.permission_definitions(permission_key) ON DELETE CASCADE not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_permission_key_fkey";

alter table "public"."role_permissions" add constraint "role_permissions_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_store_id_fkey";

alter table "public"."role_permissions" add constraint "role_permissions_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.employees(id) not valid;

alter table "public"."role_permissions" validate constraint "role_permissions_updated_by_fkey";

alter table "public"."role_permissions_audit" add constraint "role_permissions_audit_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES public.employees(id) not valid;

alter table "public"."role_permissions_audit" validate constraint "role_permissions_audit_changed_by_fkey";

alter table "public"."role_permissions_audit" add constraint "role_permissions_audit_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."role_permissions_audit" validate constraint "role_permissions_audit_store_id_fkey";

alter table "public"."safe_balance_history" add constraint "safe_balance_history_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."safe_balance_history" validate constraint "safe_balance_history_created_by_id_fkey";

alter table "public"."safe_balance_history" add constraint "safe_balance_history_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."safe_balance_history" validate constraint "safe_balance_history_store_id_fkey";

alter table "public"."safe_balance_history" add constraint "safe_balance_history_updated_by_id_fkey" FOREIGN KEY (updated_by_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."safe_balance_history" validate constraint "safe_balance_history_updated_by_id_fkey";

alter table "public"."sale_tickets" add constraint "sale_tickets_approval_performer_id_fkey" FOREIGN KEY (approval_performer_id) REFERENCES public.employees(id) not valid;

alter table "public"."sale_tickets" validate constraint "sale_tickets_approval_performer_id_fkey";

alter table "public"."sale_tickets" add constraint "sale_tickets_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES public.employees(id) not valid;

alter table "public"."sale_tickets" validate constraint "sale_tickets_approved_by_fkey";

alter table "public"."sale_tickets" add constraint "sale_tickets_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) not valid;

alter table "public"."sale_tickets" validate constraint "sale_tickets_client_id_fkey";

alter table "public"."sale_tickets" add constraint "sale_tickets_closed_by_fkey" FOREIGN KEY (closed_by) REFERENCES public.employees(id) not valid;

alter table "public"."sale_tickets" validate constraint "sale_tickets_closed_by_fkey";

alter table "public"."sale_tickets" add constraint "sale_tickets_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES public.employees(id) not valid;

alter table "public"."sale_tickets" validate constraint "sale_tickets_completed_by_fkey";

alter table "public"."sale_tickets" add constraint "sale_tickets_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.employees(id) not valid;

alter table "public"."sale_tickets" validate constraint "sale_tickets_created_by_fkey";

alter table "public"."sale_tickets" add constraint "sale_tickets_saved_by_fkey" FOREIGN KEY (saved_by) REFERENCES public.employees(id) not valid;

alter table "public"."sale_tickets" validate constraint "sale_tickets_saved_by_fkey";

alter table "public"."sale_tickets" add constraint "sale_tickets_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) not valid;

alter table "public"."sale_tickets" validate constraint "sale_tickets_store_id_fkey";

alter table "public"."store_product_preferences" add constraint "store_product_preferences_last_used_purchase_unit_id_fkey" FOREIGN KEY (last_used_purchase_unit_id) REFERENCES public.store_product_purchase_units(id) ON DELETE SET NULL not valid;

alter table "public"."store_product_preferences" validate constraint "store_product_preferences_last_used_purchase_unit_id_fkey";

alter table "public"."store_product_preferences" add constraint "store_product_preferences_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."store_product_preferences" validate constraint "store_product_preferences_store_id_fkey";

alter table "public"."store_product_preferences" add constraint "store_product_preferences_updated_by_id_fkey" FOREIGN KEY (updated_by_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."store_product_preferences" validate constraint "store_product_preferences_updated_by_id_fkey";

alter table "public"."store_product_purchase_units" add constraint "store_product_purchase_units_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."store_product_purchase_units" validate constraint "store_product_purchase_units_store_id_fkey";

alter table "public"."store_service_categories" add constraint "store_service_categories_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."store_service_categories" validate constraint "store_service_categories_store_id_fkey";

alter table "public"."store_services" add constraint "store_services_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE not valid;

alter table "public"."store_services" validate constraint "store_services_service_id_fkey";

alter table "public"."store_services" add constraint "store_services_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."store_services" validate constraint "store_services_store_id_fkey";

alter table "public"."technician_ready_queue" add constraint "technician_ready_queue_current_open_ticket_id_fkey" FOREIGN KEY (current_open_ticket_id) REFERENCES public.sale_tickets(id) ON DELETE SET NULL not valid;

alter table "public"."technician_ready_queue" validate constraint "technician_ready_queue_current_open_ticket_id_fkey";

alter table "public"."technician_ready_queue" add constraint "technician_ready_queue_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."technician_ready_queue" validate constraint "technician_ready_queue_employee_id_fkey";

alter table "public"."technician_ready_queue" add constraint "technician_ready_queue_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."technician_ready_queue" validate constraint "technician_ready_queue_store_id_fkey";

alter table "public"."ticket_activity_log" add constraint "ticket_activity_log_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) not valid;

alter table "public"."ticket_activity_log" validate constraint "ticket_activity_log_employee_id_fkey";

alter table "public"."ticket_activity_log" add constraint "ticket_activity_log_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.sale_tickets(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_activity_log" validate constraint "ticket_activity_log_ticket_id_fkey";

alter table "public"."ticket_items" add constraint "ticket_items_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES public.employees(id) not valid;

alter table "public"."ticket_items" validate constraint "ticket_items_completed_by_fkey";

alter table "public"."ticket_items" add constraint "ticket_items_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT not valid;

alter table "public"."ticket_items" validate constraint "ticket_items_employee_id_fkey";

alter table "public"."ticket_items" add constraint "ticket_items_sale_ticket_id_fkey" FOREIGN KEY (sale_ticket_id) REFERENCES public.sale_tickets(id) ON DELETE CASCADE not valid;

alter table "public"."ticket_items" validate constraint "ticket_items_sale_ticket_id_fkey";

alter table "public"."ticket_items" add constraint "ticket_items_store_service_id_fkey" FOREIGN KEY (store_service_id) REFERENCES public.store_services(id) ON DELETE RESTRICT not valid;

alter table "public"."ticket_items" validate constraint "ticket_items_store_service_id_fkey";

create or replace view "public"."pending_approval_debug" as  SELECT st.id,
    st.ticket_no,
    st.approval_required_level,
    st.approval_reason,
    st.performed_and_closed_by_same_person,
    st.closed_by_roles,
    e.display_name AS closer_name,
    e.role AS closer_roles_from_db,
    ( SELECT count(DISTINCT ticket_items.employee_id) AS count
           FROM public.ticket_items
          WHERE (ticket_items.sale_ticket_id = st.id)) AS performer_count,
    ( SELECT string_agg(DISTINCT emp.display_name, ', '::text) AS string_agg
           FROM (public.ticket_items ti
             JOIN public.employees emp ON ((ti.employee_id = emp.id)))
          WHERE (ti.sale_ticket_id = st.id)) AS performer_names,
    (st.closed_by IN ( SELECT DISTINCT ticket_items.employee_id
           FROM public.ticket_items
          WHERE (ticket_items.sale_ticket_id = st.id))) AS closer_is_performer
   FROM (public.sale_tickets st
     LEFT JOIN public.employees e ON ((st.closed_by = e.id)))
  WHERE ((st.approval_status = 'pending_approval'::text) AND (st.closed_at IS NOT NULL))
  ORDER BY st.ticket_date DESC;



  create policy "Admins can delete versions"
  on "public"."app_versions"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = ( SELECT auth.uid() AS uid)) AND ('Admin'::text = ANY (employees.role))))));



  create policy "Admins can insert versions"
  on "public"."app_versions"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = ( SELECT auth.uid() AS uid)) AND ('Admin'::text = ANY (employees.role))))));



  create policy "Admins can update versions"
  on "public"."app_versions"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = ( SELECT auth.uid() AS uid)) AND ('Admin'::text = ANY (employees.role))))));



  create policy "Users can create comments in their store"
  on "public"."attendance_comments"
  as permissive
  for insert
  to authenticated
with check (((employee_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.attendance_records ar
     JOIN public.employee_stores es ON ((es.employee_id = auth.uid())))
  WHERE ((ar.id = attendance_comments.attendance_record_id) AND (ar.store_id = es.store_id))))));



  create policy "Users can view comments in their store"
  on "public"."attendance_comments"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.attendance_records ar
     JOIN public.employee_stores es ON ((es.employee_id = auth.uid())))
  WHERE ((ar.id = attendance_comments.attendance_record_id) AND (ar.store_id = es.store_id)))));



  create policy "Managers and above can view auto-approval runs"
  on "public"."auto_approval_runs"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.id = ( SELECT auth.uid() AS uid)) AND (('Manager'::text = ANY (e.role)) OR ('Admin'::text = ANY (e.role)) OR ('Owner'::text = ANY (e.role)))))));



  create policy "Users can view edit history for their store"
  on "public"."cash_transaction_edit_history"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM ((public.cash_transactions ct
     JOIN public.employees e ON ((e.id = ( SELECT auth.uid() AS uid))))
     JOIN public.employee_stores es ON ((es.employee_id = e.id)))
  WHERE ((ct.id = cash_transaction_edit_history.transaction_id) AND (ct.store_id = es.store_id)))));



  create policy "Employees can only create transactions for assigned stores"
  on "public"."cash_transactions"
  as permissive
  for insert
  to anon, authenticated
with check (public.check_employee_store_access(created_by_id, store_id));



  create policy "Managers can view audit records"
  on "public"."inventory_approval_audit_log"
  as permissive
  for select
  to anon
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = ( SELECT auth.uid() AS uid)) AND ('manager'::text = ANY (employees.role)) AND (employees.status = 'active'::text)))));



  create policy "Employees and management can view removal records"
  on "public"."queue_removals_log"
  as permissive
  for select
  to authenticated
using (((employee_id = ( SELECT auth.uid() AS uid)) OR (store_id IN ( SELECT es.store_id
   FROM (public.employee_stores es
     JOIN public.employees e ON ((e.id = es.employee_id)))
  WHERE ((es.employee_id = ( SELECT auth.uid() AS uid)) AND (e.role && ARRAY['manager'::text, 'owner'::text, 'admin'::text]))))));



  create policy "Management can create removal records"
  on "public"."queue_removals_log"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM (public.employees e
     JOIN public.employee_stores es ON ((e.id = es.employee_id)))
  WHERE ((e.id = auth.uid()) AND (es.store_id = queue_removals_log.store_id) AND (e.role && ARRAY['Manager'::text, 'Supervisor'::text, 'Admin'::text, 'Owner'::text])))));



  create policy "Employees can create reports"
  on "public"."queue_violation_reports"
  as permissive
  for insert
  to anon
with check ((EXISTS ( SELECT 1
   FROM public.employee_stores
  WHERE ((employee_stores.employee_id = queue_violation_reports.reporter_employee_id) AND (employee_stores.store_id = queue_violation_reports.store_id)))));



  create policy "Admin and Owner can insert role permissions"
  on "public"."role_permissions"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM (public.employees e
     JOIN public.employee_stores es ON ((e.id = es.employee_id)))
  WHERE ((e.id = ( SELECT auth.uid() AS uid)) AND (es.store_id = role_permissions.store_id) AND ((e.role @> ARRAY['Admin'::text]) OR (e.role @> ARRAY['Owner'::text]))))));



  create policy "Admin and Owner can update role permissions"
  on "public"."role_permissions"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.employees e
     JOIN public.employee_stores es ON ((e.id = es.employee_id)))
  WHERE ((e.id = ( SELECT auth.uid() AS uid)) AND (es.store_id = role_permissions.store_id) AND ((e.role @> ARRAY['Admin'::text]) OR (e.role @> ARRAY['Owner'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM (public.employees e
     JOIN public.employee_stores es ON ((e.id = es.employee_id)))
  WHERE ((e.id = ( SELECT auth.uid() AS uid)) AND (es.store_id = role_permissions.store_id) AND ((e.role @> ARRAY['Admin'::text]) OR (e.role @> ARRAY['Owner'::text]))))));



  create policy "Users can read role permissions for their stores"
  on "public"."role_permissions"
  as permissive
  for select
  to authenticated
using ((store_id IN ( SELECT es.store_id
   FROM public.employee_stores es
  WHERE (es.employee_id = ( SELECT auth.uid() AS uid)))));



  create policy "Users can read audit logs for their stores"
  on "public"."role_permissions_audit"
  as permissive
  for select
  to authenticated
using ((store_id IN ( SELECT es.store_id
   FROM public.employee_stores es
  WHERE (es.employee_id = ( SELECT auth.uid() AS uid)))));



  create policy "Admin, Manager, Supervisor, Owner can insert services"
  on "public"."services"
  as permissive
  for insert
  to anon, authenticated
with check ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (('Admin'::text = ANY (employees.role)) OR ('Manager'::text = ANY (employees.role)) OR ('Supervisor'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role))) AND (employees.status = 'Active'::text)))));



  create policy "Admin, Manager, Supervisor, Owner can update services"
  on "public"."services"
  as permissive
  for update
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (('Admin'::text = ANY (employees.role)) OR ('Manager'::text = ANY (employees.role)) OR ('Supervisor'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role))) AND (employees.status = 'Active'::text)))));



  create policy "Only Admin can delete services"
  on "public"."services"
  as permissive
  for delete
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (('Admin'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role))) AND (employees.status = 'Active'::text)))));



  create policy "Admin, Manager, Supervisor can manage store services"
  on "public"."store_services"
  as permissive
  for all
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (('Admin'::text = ANY (employees.role)) OR ('Manager'::text = ANY (employees.role)) OR ('Supervisor'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role))) AND (employees.status = 'Active'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (('Admin'::text = ANY (employees.role)) OR ('Manager'::text = ANY (employees.role)) OR ('Supervisor'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role))) AND (employees.status = 'Active'::text)))));



  create policy "Admins can manage stores"
  on "public"."stores"
  as permissive
  for all
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (employees.status = 'Active'::text) AND (('Admin'::text = ANY (employees.role)) OR ('Manager'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role)))))));


CREATE TRIGGER update_attendance_change_proposals_updated_at BEFORE UPDATE ON public.attendance_change_proposals FOR EACH ROW EXECUTE FUNCTION public.update_attendance_change_proposals_updated_at();

CREATE TRIGGER update_cash_transaction_change_proposals_updated_at BEFORE UPDATE ON public.cash_transaction_change_proposals FOR EACH ROW EXECUTE FUNCTION public.update_cash_transaction_change_proposals_updated_at();

CREATE TRIGGER log_cash_transaction_edits AFTER UPDATE ON public.cash_transactions FOR EACH ROW EXECUTE FUNCTION public.log_cash_transaction_edit();

CREATE TRIGGER trigger_cash_transactions_updated_at BEFORE UPDATE ON public.cash_transactions FOR EACH ROW EXECUTE FUNCTION public.update_cash_transactions_updated_at();

CREATE TRIGGER trigger_headquarter_deposit_transfer AFTER INSERT ON public.cash_transactions FOR EACH ROW EXECUTE FUNCTION public.create_headquarter_deposit_transfer();

CREATE TRIGGER validate_weekly_schedule_trigger BEFORE INSERT OR UPDATE OF weekly_schedule ON public.employees FOR EACH ROW EXECUTE FUNCTION public.validate_weekly_schedule();

CREATE TRIGGER trg_calculate_closing_cash_amount BEFORE INSERT OR UPDATE ON public.end_of_day_records FOR EACH ROW EXECUTE FUNCTION public.calculate_closing_cash_amount();

CREATE TRIGGER trg_calculate_opening_cash_amount BEFORE INSERT OR UPDATE ON public.end_of_day_records FOR EACH ROW EXECUTE FUNCTION public.calculate_opening_cash_amount();

CREATE TRIGGER trigger_update_lot_status BEFORE UPDATE ON public.inventory_purchase_lots FOR EACH ROW EXECUTE FUNCTION public.update_lot_status();

CREATE TRIGGER trg_auto_approve_inventory BEFORE UPDATE ON public.inventory_transactions FOR EACH ROW EXECUTE FUNCTION public.auto_approve_inventory_transaction();

CREATE TRIGGER trigger_create_lots_from_approved_transaction AFTER UPDATE ON public.inventory_transactions FOR EACH ROW EXECUTE FUNCTION public.create_lots_from_approved_transaction();

CREATE TRIGGER trigger_update_inventory_on_approval AFTER UPDATE ON public.inventory_transactions FOR EACH ROW EXECUTE FUNCTION public.update_inventory_on_transaction_approval();

CREATE TRIGGER trigger_log_permission_changes AFTER UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();

CREATE TRIGGER trigger_update_role_permissions_timestamp BEFORE UPDATE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.update_role_permissions_updated_at();

CREATE TRIGGER trigger_safe_balance_history_updated_at BEFORE UPDATE ON public.safe_balance_history FOR EACH ROW EXECUTE FUNCTION public.update_safe_balance_history_updated_at();

CREATE TRIGGER auto_set_completed_at_trigger BEFORE UPDATE ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.auto_set_completed_at_on_close();

CREATE TRIGGER enforce_no_previous_unclosed_tickets BEFORE INSERT ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.validate_no_previous_unclosed_tickets();

CREATE TRIGGER ensure_approval_status_consistency BEFORE INSERT OR UPDATE ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.validate_approval_status_consistency();

CREATE TRIGGER ensure_opening_cash_before_ticket BEFORE INSERT ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.validate_opening_cash_before_ticket();

CREATE TRIGGER on_ticket_delete_update_queue BEFORE DELETE ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.handle_ticket_delete_queue_update();

CREATE TRIGGER sale_tickets_mark_available AFTER UPDATE OF completed_at ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_technicians_available();

CREATE TRIGGER trigger_set_approval_deadline BEFORE UPDATE ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.set_approval_deadline();

CREATE TRIGGER trigger_ensure_single_default_purchase_unit BEFORE INSERT OR UPDATE ON public.store_product_purchase_units FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_purchase_unit();

CREATE TRIGGER trigger_store_service_categories_updated_at BEFORE UPDATE ON public.store_service_categories FOR EACH ROW EXECUTE FUNCTION public.update_store_service_categories_updated_at();

CREATE TRIGGER ticket_items_auto_complete_previous AFTER INSERT ON public.ticket_items FOR EACH ROW EXECUTE FUNCTION public.auto_complete_previous_tickets();

CREATE TRIGGER ticket_items_mark_busy AFTER INSERT ON public.ticket_items FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_technician_busy();

CREATE TRIGGER ticket_items_mark_busy_on_update AFTER UPDATE OF employee_id ON public.ticket_items FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_technician_busy_on_update();

CREATE TRIGGER trigger_auto_populate_started_at BEFORE INSERT ON public.ticket_items FOR EACH ROW EXECUTE FUNCTION public.auto_populate_ticket_item_started_at();


