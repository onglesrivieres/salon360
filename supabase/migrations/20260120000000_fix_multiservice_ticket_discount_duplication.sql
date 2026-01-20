-- Migration: Fix multi-service ticket DISCOUNT duplication
-- Description: Discount values were also duplicated on every item in multi-service tickets.
--              This migration zeros out discount values on non-first items.
--              This is a follow-up to 20260119000000 which fixed payment/tip duplication
--              but missed the discount fields.

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
  discount_percentage = 0,
  discount_amount = 0,
  discount_percentage_cash = 0,
  discount_amount_cash = 0
FROM non_first_items nfi
WHERE ti.id = nfi.id
  AND (
    -- Only update if there are non-zero values to fix
    ti.discount_percentage != 0
    OR ti.discount_amount != 0
    OR ti.discount_percentage_cash != 0
    OR ti.discount_amount_cash != 0
  );
