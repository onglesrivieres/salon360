-- Migration: Enforce no standalone items (all top-level items must be masters)
-- A previous migration already converted standalones to masters in the DB,
-- but this adds a CHECK constraint to prevent future standalones.

-- Safety: convert any remaining standalones to masters
UPDATE inventory_items
SET is_master_item = true
WHERE parent_id IS NULL AND is_master_item = false;

-- Add CHECK constraint: top-level items must be masters
DO $$ BEGIN
  ALTER TABLE inventory_items
    ADD CONSTRAINT chk_no_standalone_items
    CHECK (parent_id IS NOT NULL OR is_master_item = true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
