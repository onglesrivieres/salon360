/*
  # Fix Function Search Path

  The previous migration set search_path to empty string (''), which broke all functions
  because they couldn't find tables in the public schema.

  This migration corrects the search_path to use 'public, pg_temp' which:
  - Allows functions to find tables in the public schema
  - Includes pg_temp for temporary tables
  - Still protects against search path injection by being explicit

  This is the recommended secure setting for PostgreSQL functions.
*/

-- Set search_path to 'public, pg_temp' for all functions
ALTER FUNCTION auto_checkout_all_at_closing_time() SET search_path = 'public, pg_temp';
ALTER FUNCTION check_in_employee(p_employee_id uuid, p_store_id uuid, p_pay_type text) SET search_path = 'public, pg_temp';
ALTER FUNCTION check_out_employee(p_employee_id uuid, p_store_id uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION auto_release_queue_at_closing() SET search_path = 'public, pg_temp';
ALTER FUNCTION get_sorted_technicians_for_store(p_store_id uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION can_checkin_now(p_store_id uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION is_technician_checked_in_today(p_employee_id uuid, p_store_id uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION get_latest_app_version() SET search_path = 'public, pg_temp';
ALTER FUNCTION get_services_by_popularity(p_store_id uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION auto_approve_expired_tickets() SET search_path = 'public, pg_temp';
ALTER FUNCTION reject_ticket(p_ticket_id uuid, p_employee_id uuid, p_rejection_reason text) SET search_path = 'public, pg_temp';
ALTER FUNCTION log_auto_approval_activity() SET search_path = 'public, pg_temp';
ALTER FUNCTION mark_technician_busy(p_employee_id uuid, p_ticket_id uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION trigger_mark_technician_busy() SET search_path = 'public, pg_temp';
ALTER FUNCTION trigger_mark_technicians_available() SET search_path = 'public, pg_temp';
ALTER FUNCTION get_last_service_completion_time(p_employee_id uuid, p_store_id uuid) SET search_path = 'public, pg_temp';
ALTER FUNCTION auto_checkout_inactive_daily_employees() SET search_path = 'public, pg_temp';
