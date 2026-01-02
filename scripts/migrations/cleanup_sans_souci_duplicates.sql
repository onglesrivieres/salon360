/*
  # Remove Duplicate Settings from Sans Souci Store

  1. Problem
    - Sans Souci has 61 settings instead of 56
    - It has both old and new versions of 5 settings

  2. Duplicates to Remove (old versions)
    - admin_review_rejected_tickets → replaced by require_admin_review_rejected
    - auto_approve_after_48_hours → replaced by auto_approve_after_deadline
    - enable_ticket_approval_system → replaced by enable_ticket_approvals
    - require_opening_cash_validation → replaced by require_opening_cash
    - show_queue_button_in_header → replaced by show_queue_in_header

  3. Result
    - Sans Souci will have 56 settings matching all other stores
*/

-- Remove the 5 duplicate old settings from Sans Souci
DELETE FROM public.app_settings
WHERE store_id = (SELECT id FROM public.stores WHERE name = 'Sans Souci' LIMIT 1)
AND setting_key IN (
  'admin_review_rejected_tickets',
  'auto_approve_after_48_hours',
  'enable_ticket_approval_system',
  'require_opening_cash_validation',
  'show_queue_button_in_header'
);
