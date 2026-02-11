-- Convert existing standalone items (not master, no parent) to master items
UPDATE inventory_items
SET is_master_item = true
WHERE is_master_item = false AND parent_id IS NULL;

NOTIFY pgrst, 'reload schema';
