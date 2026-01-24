/*
  # Fix Function Search Path Security Issues

  1. Changes
    - Set search_path to empty string for all functions to prevent search_path manipulation attacks
    - All table references must now be fully qualified with schema name
    - This follows PostgreSQL security best practices

  2. Security
    - Prevents malicious users from hijacking function behavior through search_path manipulation
    - Ensures functions always reference the correct schema objects
    
  3. Functions Updated (17 total)
    - auto_checkout_all_at_closing_time()
    - can_checkin_now(p_store_id uuid)
    - is_technician_checked_in_today(p_employee_id uuid, p_store_id uuid)
    - get_latest_app_version()
    - get_services_by_popularity(p_store_id uuid)
    - trigger_mark_technician_busy()
    - trigger_mark_technicians_available()
    - check_in_employee(p_employee_id uuid, p_store_id uuid, p_pay_type text)
    - check_out_employee(p_employee_id uuid, p_store_id uuid)
    - auto_release_queue_at_closing()
    - get_sorted_technicians_for_store(p_store_id uuid)
    - auto_approve_expired_tickets()
    - reject_ticket(p_ticket_id uuid, p_employee_id uuid, p_rejection_reason text)
    - log_auto_approval_activity()
    - mark_technician_busy(p_employee_id uuid, p_ticket_id uuid)
    - get_last_service_completion_time(p_employee_id uuid, p_store_id uuid)
    - auto_checkout_inactive_daily_employees()
*/

-- Set search_path to empty string for all affected functions
ALTER FUNCTION public.auto_checkout_all_at_closing_time() SET search_path = '';
ALTER FUNCTION public.can_checkin_now(p_store_id uuid) SET search_path = '';
ALTER FUNCTION public.is_technician_checked_in_today(p_employee_id uuid, p_store_id uuid) SET search_path = '';
ALTER FUNCTION public.get_latest_app_version() SET search_path = '';
ALTER FUNCTION public.get_services_by_popularity(p_store_id uuid) SET search_path = '';
ALTER FUNCTION public.trigger_mark_technician_busy() SET search_path = '';
ALTER FUNCTION public.trigger_mark_technicians_available() SET search_path = '';
ALTER FUNCTION public.check_in_employee(p_employee_id uuid, p_store_id uuid, p_pay_type text) SET search_path = '';
ALTER FUNCTION public.check_out_employee(p_employee_id uuid, p_store_id uuid) SET search_path = '';
ALTER FUNCTION public.auto_release_queue_at_closing() SET search_path = '';
ALTER FUNCTION public.get_sorted_technicians_for_store(p_store_id uuid) SET search_path = '';
ALTER FUNCTION public.auto_approve_expired_tickets() SET search_path = '';
ALTER FUNCTION public.reject_ticket(p_ticket_id uuid, p_employee_id uuid, p_rejection_reason text) SET search_path = '';
ALTER FUNCTION public.log_auto_approval_activity() SET search_path = '';
ALTER FUNCTION public.mark_technician_busy(p_employee_id uuid, p_ticket_id uuid) SET search_path = '';
ALTER FUNCTION public.get_last_service_completion_time(p_employee_id uuid, p_store_id uuid) SET search_path = '';
ALTER FUNCTION public.auto_checkout_inactive_daily_employees() SET search_path = '';
