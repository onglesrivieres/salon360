-- Add missing columns to role_permissions table
-- The squashed migration (20260124000003) defined these columns in CREATE TABLE IF NOT EXISTS,
-- but since the table already existed, the columns were never added.

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.employees(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.employees(id);
