-- Fix missing UNIQUE constraint on role_permissions table
-- The constraint was defined in CREATE TABLE IF NOT EXISTS but never applied
-- because the table already existed. The ON CONFLICT clause in
-- update_role_permission() requires this constraint.

-- Step 1: Remove duplicate rows (keep the most recently updated one)
DELETE FROM public.role_permissions a
USING public.role_permissions b
WHERE a.store_id = b.store_id
  AND a.role_name = b.role_name
  AND a.permission_key = b.permission_key
  AND a.id < b.id;

-- Step 2: Drop the non-unique composite index (will be replaced by the unique constraint's index)
DROP INDEX IF EXISTS public.idx_role_permissions_composite;

-- Step 3: Add the missing unique constraint
ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_store_role_permission_key
  UNIQUE (store_id, role_name, permission_key);
