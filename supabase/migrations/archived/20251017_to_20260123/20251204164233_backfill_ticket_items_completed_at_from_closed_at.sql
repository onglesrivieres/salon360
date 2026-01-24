/*
  # Backfill Completed At Timestamps for Ticket Items

  1. Purpose
    - Populates missing `completed_at` timestamps in ticket_items using ticket-level `closed_at` as fallback
    - Only processes closed tickets to ensure data quality
    - Enables historical duration calculations for services

  2. Changes
    - Updates all ticket_items where completed_at IS NULL
    - Uses parent ticket's closed_at timestamp as the fallback
    - Only processes items belonging to closed tickets (closed_at IS NOT NULL)

  3. Notes
    - This is a one-time backfill for historical data
    - Complements the started_at backfill to provide complete duration data
*/

-- Backfill completed_at for ticket_items using ticket's closed_at
UPDATE public.ticket_items ti
SET completed_at = t.closed_at
FROM public.sale_tickets t
WHERE ti.sale_ticket_id = t.id
  AND ti.completed_at IS NULL
  AND t.closed_at IS NOT NULL;
