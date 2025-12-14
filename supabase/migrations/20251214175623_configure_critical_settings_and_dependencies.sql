/*
  # Configure Critical Settings and Dependencies
  
  1. Mark Critical Settings
    - Enable ticket approval system
    - Auto-checkout employees at closing time
    - Require opening cash count before creating tickets
    - Enable inventory module
    - Enable real-time data refresh
    
  2. Set Up Dependencies
    - Map parent-child relationships between settings
    - Define which settings affect or require other settings
    - Identify conflicting settings
    
  3. Add Help Text
    - Provide detailed explanations for each setting
    - Include impact warnings for critical settings
    
  4. Set Display Order
    - Group related settings together
    - Prioritize important settings
*/

-- Mark critical settings that require confirmation before changing
UPDATE public.app_settings
SET 
  is_critical = true,
  requires_restart = true,
  help_text = 'When enabled, tickets must be approved by management before payment collection. This adds an extra layer of oversight but may slow down checkout. Disabling this allows immediate payment without approval.'
WHERE setting_key = 'enable_ticket_approval_system';

UPDATE public.app_settings
SET 
  is_critical = true,
  help_text = 'Automatically checks out all employees at the store''s closing time. This ensures accurate time tracking but may check out employees who are still working on closing tasks. You can manually check in again if needed.'
WHERE setting_key = 'auto_checkout_employees_at_closing';

UPDATE public.app_settings
SET 
  is_critical = true,
  help_text = 'Requires managers to count opening cash before any tickets can be created for the day. This ensures proper cash tracking but prevents ticket creation until cash count is complete.'
WHERE setting_key = 'require_opening_cash_count';

UPDATE public.app_settings
SET 
  is_critical = true,
  requires_restart = true,
  help_text = 'Enables the full inventory management module including stock tracking, distributions, and audits. Disabling will hide all inventory features but data remains intact.'
WHERE setting_key = 'enable_inventory_module';

UPDATE public.app_settings
SET 
  is_critical = true,
  requires_restart = true,
  help_text = 'Enables automatic real-time updates for data changes across all devices. Disabling requires manual page refresh to see updates. May affect performance on slower connections.'
WHERE setting_key = 'enable_realtime_refresh';

-- Set up dependencies between settings
UPDATE public.app_settings
SET dependencies = '[
  {"key": "auto_approve_after_48_hours", "type": "affects", "label": "Auto-approve after 48 hours"},
  {"key": "admin_review_rejected_tickets", "type": "affects", "label": "Admin review for rejected tickets"}
]'::jsonb
WHERE setting_key = 'enable_ticket_approval_system';

UPDATE public.app_settings
SET dependencies = '[
  {"key": "enable_ticket_approval_system", "type": "requires", "label": "Enable ticket approval system"}
]'::jsonb
WHERE setting_key IN ('auto_approve_after_48_hours', 'admin_review_rejected_tickets');

UPDATE public.app_settings
SET dependencies = '[
  {"key": "show_opening_cash_missing_banner", "type": "affects", "label": "Show opening cash missing banner"}
]'::jsonb
WHERE setting_key = 'require_opening_cash_count';

UPDATE public.app_settings
SET dependencies = '[
  {"key": "require_opening_cash_count", "type": "requires", "label": "Require opening cash count"}
]'::jsonb
WHERE setting_key = 'show_opening_cash_missing_banner';

UPDATE public.app_settings
SET dependencies = '[
  {"key": "show_queue_button_in_header", "type": "affects", "label": "Show queue button in header"}
]'::jsonb
WHERE setting_key = 'enable_ready_queue';

UPDATE public.app_settings
SET dependencies = '[
  {"key": "enable_ready_queue", "type": "requires", "label": "Enable ready queue"}
]'::jsonb
WHERE setting_key = 'show_queue_button_in_header';

-- Set display order for logical grouping (within each category)
-- Ticket-related settings
UPDATE public.app_settings SET display_order = 10 WHERE setting_key = 'enable_ticket_approval_system';
UPDATE public.app_settings SET display_order = 20 WHERE setting_key = 'auto_approve_after_48_hours';
UPDATE public.app_settings SET display_order = 30 WHERE setting_key = 'admin_review_rejected_tickets';
UPDATE public.app_settings SET display_order = 40 WHERE setting_key = 'enable_ready_queue';
UPDATE public.app_settings SET display_order = 50 WHERE setting_key = 'show_queue_button_in_header';

-- Cash-related settings
UPDATE public.app_settings SET display_order = 10 WHERE setting_key = 'require_opening_cash_count';
UPDATE public.app_settings SET display_order = 20 WHERE setting_key = 'show_opening_cash_missing_banner';

-- Attendance-related settings
UPDATE public.app_settings SET display_order = 10 WHERE setting_key = 'auto_checkout_employees_at_closing';

-- System-related settings
UPDATE public.app_settings SET display_order = 10 WHERE setting_key = 'enable_realtime_refresh';
UPDATE public.app_settings SET display_order = 20 WHERE setting_key = 'enable_inventory_module';

-- Add help text for other common settings
UPDATE public.app_settings
SET help_text = 'When enabled, technicians can create their own tickets without receptionist assistance. Useful for busy periods or self-service models.'
WHERE setting_key = 'enable_self_service_tickets';

UPDATE public.app_settings
SET help_text = 'Displays a queue button in the header navigation for quick access to the technician ready queue.'
WHERE setting_key = 'show_queue_button_in_header';

UPDATE public.app_settings
SET help_text = 'Shows a prominent banner at the top of the page when opening cash count has not been completed for today.'
WHERE setting_key = 'show_opening_cash_missing_banner';

UPDATE public.app_settings
SET help_text = 'Automatically approves tickets that have been pending for more than 48 hours to prevent old tickets from clogging the approval queue.'
WHERE setting_key = 'auto_approve_after_48_hours';

UPDATE public.app_settings
SET help_text = 'Requires admin review for tickets that were rejected. Provides additional oversight for problematic tickets.'
WHERE setting_key = 'admin_review_rejected_tickets';
