-- Recategorize DND items into dedicated "DND Collections" category
UPDATE inventory_items
SET category = 'DND Collections'
WHERE name LIKE 'DND %'
  AND category = 'Nail Polish & Products';
