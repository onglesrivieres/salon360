-- Seed "Bottle" purchase unit (multiplier=1) for all DND items across all stores
-- Handles schema difference: Salon360QC uses "item_id", Salon365 uses "master_item_id"
DO $$
DECLARE
  v_col_name text;
BEGIN
  -- Detect which column name exists
  SELECT column_name INTO v_col_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'store_product_purchase_units'
    AND column_name IN ('item_id', 'master_item_id')
  LIMIT 1;

  EXECUTE format(
    'INSERT INTO public.store_product_purchase_units
       (store_id, %I, unit_name, multiplier, is_default, display_order)
     SELECT
       sil.store_id,
       ii.id,
       ''Bottle'',
       1,
       true,
       0
     FROM public.inventory_items ii
     JOIN public.store_inventory_levels sil ON sil.item_id = ii.id
     WHERE ii.brand = ''DND''
     ON CONFLICT (store_id, %I, unit_name) DO NOTHING',
    v_col_name, v_col_name
  );
END $$;
