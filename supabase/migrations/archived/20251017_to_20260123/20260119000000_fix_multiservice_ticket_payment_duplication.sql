-- Migration: Fix multi-service ticket payment duplication
-- Description: For multi-service tickets, payment values were duplicated on every item,
--              causing EOD to over-count cash. This migration keeps payment values only
--              on the first item and sets subsequent items to 0.

-- First, let's identify and fix multi-service tickets
-- We'll use a window function to find the first item of each ticket (by created_at)

WITH ranked_items AS (
  -- Rank items within each ticket by created_at (first created = rank 1)
  SELECT
    id,
    sale_ticket_id,
    ROW_NUMBER() OVER (PARTITION BY sale_ticket_id ORDER BY created_at, id::text) as item_rank
  FROM ticket_items
),
non_first_items AS (
  -- Get items that are NOT the first in their ticket (rank > 1)
  SELECT ri.id
  FROM ranked_items ri
  WHERE ri.item_rank > 1
    AND ri.sale_ticket_id IN (
      -- Only for multi-service tickets
      SELECT sale_ticket_id
      FROM ticket_items
      GROUP BY sale_ticket_id
      HAVING COUNT(*) > 1
    )
)
UPDATE ticket_items ti
SET
  payment_cash = 0,
  payment_card = 0,
  payment_gift_card = 0,
  tip_customer_cash = 0,
  tip_customer_card = 0,
  tip_receptionist = 0
FROM non_first_items nfi
WHERE ti.id = nfi.id
  AND (
    -- Only update if there are non-zero values to fix
    ti.payment_cash != 0
    OR ti.payment_card != 0
    OR ti.payment_gift_card != 0
    OR ti.tip_customer_cash != 0
    OR ti.tip_customer_card != 0
    OR ti.tip_receptionist != 0
  );
