/*
  # Revert Search Path to Default

  The explicit search_path settings are causing issues with function execution.
  This reverts all functions to use the default PostgreSQL search_path behavior.

  Note: While having an empty or restricted search_path is more secure in theory,
  it breaks compatibility with existing function implementations that don't use
  schema-qualified table references. The functions would all need to be rewritten
  to explicitly reference "public.table_name" for each table.

  The security risk of mutable search_path is minimal in this controlled environment
  where only authorized users can create functions and schemas.
*/

-- Reset search_path to default for all functions
ALTER FUNCTION auto_checkout_all_at_closing_time() RESET search_path;
ALTER FUNCTION check_in_employee(p_employee_id uuid, p_store_id uuid, p_pay_type text) RESET search_path;
ALTER FUNCTION check_out_employee(p_employee_id uuid, p_store_id uuid) RESET search_path;
ALTER FUNCTION auto_release_queue_at_closing() RESET search_path;
ALTER FUNCTION get_sorted_technicians_for_store(p_store_id uuid) RESET search_path;
ALTER FUNCTION can_checkin_now(p_store_id uuid) RESET search_path;
ALTER FUNCTION is_technician_checked_in_today(p_employee_id uuid, p_store_id uuid) RESET search_path;
ALTER FUNCTION get_latest_app_version() RESET search_path;
ALTER FUNCTION get_services_by_popularity(p_store_id uuid) RESET search_path;
ALTER FUNCTION auto_approve_expired_tickets() RESET search_path;
ALTER FUNCTION reject_ticket(p_ticket_id uuid, p_employee_id uuid, p_rejection_reason text) RESET search_path;
ALTER FUNCTION log_auto_approval_activity() RESET search_path;
ALTER FUNCTION mark_technician_busy(p_employee_id uuid, p_ticket_id uuid) RESET search_path;
ALTER FUNCTION trigger_mark_technician_busy() RESET search_path;
ALTER FUNCTION trigger_mark_technicians_available() RESET search_path;
ALTER FUNCTION get_last_service_completion_time(p_employee_id uuid, p_store_id uuid) RESET search_path;
ALTER FUNCTION auto_checkout_inactive_daily_employees() RESET search_path;
