-- Move all inventory items to "Nail Polish & Products" category
UPDATE public.inventory_items
SET category = 'Nail Polish & Products',
    updated_at = now()
WHERE category IS DISTINCT FROM 'Nail Polish & Products';
