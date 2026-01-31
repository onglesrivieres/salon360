-- Grant table-level permissions for store_inventory_levels
-- This was missed in the original migration (20260131162923_global_inventory_items.sql)
-- Without these GRANTs, PostgREST returns "permission denied for table store_inventory_levels"

GRANT ALL ON public.store_inventory_levels TO anon, authenticated, service_role;
