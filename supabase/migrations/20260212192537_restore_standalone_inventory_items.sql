-- Restore standalone item type for items that have no sub-items
-- Standalone = is_master_item=false, parent_id=NULL (simple individual items)
-- Only converts master items that have zero children (safe guard against orphaning)

UPDATE inventory_items
SET is_master_item = false
WHERE is_master_item = true
  AND parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM inventory_items sub WHERE sub.parent_id = inventory_items.id
  );

NOTIFY pgrst, 'reload schema';
