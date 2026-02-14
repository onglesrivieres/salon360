-- Convert all remaining standalone items to master items.
-- Standalone = not already a master AND has no parent (not a sub-item).
-- DND items are already masters so this is a no-op for them.
UPDATE inventory_items
SET is_master_item = true
WHERE is_master_item = false
  AND parent_id IS NULL;

NOTIFY pgrst, 'reload schema';
