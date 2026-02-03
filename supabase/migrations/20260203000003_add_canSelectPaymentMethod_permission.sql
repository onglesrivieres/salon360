-- Add missing tickets.canSelectPaymentMethod permission definition
-- This key exists in the frontend (permission-metadata.ts) but was never
-- inserted into the permission_definitions table, causing P0001 errors
-- when toggling it on the Configuration > Role Permissions page.

INSERT INTO public.permission_definitions (permission_key, module_name, action_name, display_name, description, is_critical, display_order)
VALUES ('tickets.canSelectPaymentMethod', 'tickets', 'select_payment_method', 'Select Payment Method', 'Ability to select payment methods (Cash, Card, Mixed) on tickets', false, 0)
ON CONFLICT (permission_key) DO NOTHING;
