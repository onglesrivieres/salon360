/*
  # Add DELETE RLS policy on inventory_transaction_items

  ## Overview
  The live DB has SELECT/INSERT/UPDATE policies but never got a DELETE policy.
  The squash migration specified FOR ALL but was never applied to live.
  This causes .delete() via PostgREST to silently return 0 rows, so draft
  item cleanup accumulates duplicates on every save.

  ## Changes

  ### Policies
  - Add DELETE policy on `inventory_transaction_items` for anon/authenticated

  ### Data Cleanup
  - Remove accumulated duplicate items in draft transactions, keeping only
    the most recent set per (transaction_id, item_id)
*/

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Add the missing DELETE policy. The live DB only has SELECT/INSERT/UPDATE.
-- DROP IF EXISTS for idempotency in case this is re-run.
DROP POLICY IF EXISTS "Allow delete inventory transaction items" ON public.inventory_transaction_items;
CREATE POLICY "Allow delete inventory transaction items"
  ON public.inventory_transaction_items FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- DATA CLEANUP: Remove accumulated duplicate items in draft transactions
-- ============================================================================

-- Keep only the most recent row per (transaction_id, item_id) in drafts.
-- Duplicates accumulated because the missing DELETE policy caused re-saves
-- to insert on top of old items instead of replacing them.
DELETE FROM public.inventory_transaction_items a
USING (
  SELECT it.transaction_id, it.item_id, max(it.created_at) AS max_created
  FROM public.inventory_transaction_items it
  JOIN public.inventory_transactions t ON t.id = it.transaction_id
  WHERE t.status = 'draft'
  GROUP BY transaction_id, item_id
) keep
WHERE a.transaction_id = keep.transaction_id
  AND a.item_id = keep.item_id
  AND a.created_at < keep.max_created
  AND EXISTS (
    SELECT 1 FROM public.inventory_transactions t
    WHERE t.id = a.transaction_id AND t.status = 'draft'
  );
