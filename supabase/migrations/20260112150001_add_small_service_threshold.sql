/*
  # Add Small Service Threshold Setting

  ## Overview
  Adds the "Small Service Threshold" configuration setting and updates the
  technician_ready_queue status constraint to include 'small_service' status.

  ## Changes
  1. Insert small_service_threshold setting for all stores (default: $30)
  2. Update status constraint to allow 'small_service' value

  ## Feature Description
  When the last technician in the Ready queue takes a service below this threshold,
  they maintain their queue position (turn NOT consumed) and are marked yellow.
*/

-- 1. Add small_service_threshold setting to app_settings for all stores
INSERT INTO public.app_settings (
  store_id,
  setting_key,
  setting_value,
  category,
  display_name,
  description,
  default_value,
  is_critical,
  requires_restart,
  help_text,
  display_order
)
SELECT
  id as store_id,
  'small_service_threshold',
  '30'::jsonb,
  'Tickets',
  'Small Service Threshold',
  'When the last technician in queue takes a service below this amount, they keep their queue position',
  '30'::jsonb,
  false,
  false,
  'Services below this dollar amount allow the last technician in queue to work without losing their turn. They will be marked yellow until the ticket closes.',
  25
FROM public.stores
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_settings
  WHERE store_id = stores.id AND setting_key = 'small_service_threshold'
);

-- 2. Update status check constraint to include 'small_service'
ALTER TABLE public.technician_ready_queue
DROP CONSTRAINT IF EXISTS technician_ready_queue_status_check;

ALTER TABLE public.technician_ready_queue
ADD CONSTRAINT technician_ready_queue_status_check
CHECK (status IN ('ready', 'busy', 'small_service'));

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
