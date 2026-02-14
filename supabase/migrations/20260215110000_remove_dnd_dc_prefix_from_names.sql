-- Remove redundant "DND DC " prefix from inventory item names.
-- These items are already categorized under DND categories, so the prefix is unnecessary.
-- Affects 362 items per store (Salon360QC and Salon365).

UPDATE public.inventory_items
SET name = REPLACE(name, 'DND DC ', ''),
    updated_at = now()
WHERE name LIKE 'DND DC %';
