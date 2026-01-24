/*
  # Add Headquarters Flag to Stores Table

  1. Changes
    - Add `is_headquarters` boolean column to stores table
    - Default is false, only one store should be headquarters
    - Set Ongles Maily as the headquarters store

  2. Purpose
    - Identify the headquarters store for cross-store transactions
    - Used by Headquarter Deposit feature to route deposits
*/

-- Add is_headquarters column to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS is_headquarters boolean DEFAULT false NOT NULL;

-- Set Ongles Maily as headquarters
UPDATE public.stores
SET is_headquarters = true
WHERE name = 'Ongles Maily';

-- Add index for quick headquarters lookup
CREATE INDEX IF NOT EXISTS idx_stores_is_headquarters
ON public.stores(is_headquarters)
WHERE is_headquarters = true;

-- Add comment to document the column
COMMENT ON COLUMN public.stores.is_headquarters IS
'Indicates if this store is the headquarters. Only one store should have this set to true.';
