/*
  # Backfill ticket client_ids

  ## Overview
  Links existing sale_tickets to clients by matching customer_phone to
  clients.phone_number within the same store. Tickets created before the
  client system was introduced (2026-01-11) have client_id = NULL even
  when a matching client exists.

  ## Changes

  ### Tables
  - `sale_tickets` - Backfills client_id where NULL by matching normalized phone numbers

  ## Notes
  - Only updates tickets where client_id IS NULL
  - Phone normalization strips (, ), -, spaces, and + to match digits-only format
  - Idempotent: safe to run multiple times (WHERE client_id IS NULL)
*/

-- Backfill client_id on sale_tickets by matching phone number + store
UPDATE sale_tickets st
SET client_id = c.id
FROM clients c
WHERE st.client_id IS NULL
  AND st.store_id = c.store_id
  AND st.customer_phone IS NOT NULL
  AND st.customer_phone <> ''
  AND replace(replace(replace(replace(replace(st.customer_phone, '(', ''), ')', ''), '-', ''), ' ', ''), '+', '')
    = c.phone_number;
