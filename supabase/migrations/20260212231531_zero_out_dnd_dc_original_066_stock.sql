-- Zero out stale store_inventory_levels for DND DC Original 066 (febbadad)
-- The previous cleanup migration deleted all lots, transaction items, and the sub-item,
-- but left the master item's aggregated stock (12 units in Salon360QC) intact.
-- With no lots or transactions backing this quantity, it's stale data.

UPDATE store_inventory_levels
SET quantity_on_hand = 0
WHERE item_id = 'febbadad-907a-4c47-bdaf-d1bcb4ce3a0e'
  AND quantity_on_hand != 0;

NOTIFY pgrst, 'reload schema';
