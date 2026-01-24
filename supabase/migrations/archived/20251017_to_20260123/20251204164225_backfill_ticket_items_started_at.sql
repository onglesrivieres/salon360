/*
  # Backfill Started At Timestamps for Ticket Items

  1. Purpose
    - Populates missing `started_at` timestamps in ticket_items using ticket-level `opened_at` as fallback
    - Only processes closed tickets to ensure data quality
    - Enables historical duration calculations for services

  2. Changes
    - Updates all ticket_items where started_at IS NULL
    - Uses parent ticket's opened_at timestamp as the fallback
    - Only processes items belonging to closed tickets (closed_at IS NOT NULL)

  3. Notes
    - This is a one-time backfill for historical data
    - Future ticket items will have started_at set automatically via trigger
*/

-- Backfill started_at for ticket_items using ticket's opened_at
UPDATE public.ticket_items ti
SET started_at = t.opened_at
FROM public.sale_tickets t
WHERE ti.sale_ticket_id = t.id
  AND ti.started_at IS NULL
  AND t.opened_at IS NOT NULL
  AND t.closed_at IS NOT NULL;
