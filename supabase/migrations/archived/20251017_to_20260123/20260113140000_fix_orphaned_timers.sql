-- Fix orphaned timers: set timer_stopped_at to ticket's closed_at
-- This fixes historical tickets where the timer was started but never stopped
-- when the ticket was closed, causing incorrect duration calculations.

UPDATE ticket_items ti
SET
  timer_stopped_at = st.closed_at,
  updated_at = NOW()
FROM sale_tickets st
WHERE ti.sale_ticket_id = st.id
  AND ti.started_at IS NOT NULL
  AND ti.timer_stopped_at IS NULL
  AND ti.completed_at IS NULL
  AND st.closed_at IS NOT NULL;
