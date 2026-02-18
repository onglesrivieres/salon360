/*
  # Add description_text column to resources

  ## Overview
  Adds a `description_text` column to store plain-text extraction of rich-text
  descriptions for search filtering and card preview display.

  ## Changes

  ### Tables
  - `resources` - Add `description_text` TEXT column, backfill from `description`

  ## Notes
  - `description` will store HTML (Tiptap editor output)
  - `description_text` stores plain-text extraction (via editor.getText())
  - Backfill copies existing plain-text descriptions to the new column
*/

-- ============================================================================
-- COLUMNS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'resources'
      AND column_name = 'description_text'
  ) THEN
    ALTER TABLE public.resources ADD COLUMN description_text text;
  END IF;
END $$;

-- ============================================================================
-- BACKFILL
-- ============================================================================

-- Copy existing plain-text descriptions to description_text
UPDATE public.resources
SET description_text = description
WHERE description IS NOT NULL
  AND description_text IS NULL;

-- ============================================================================
-- SCHEMA RELOAD
-- ============================================================================

NOTIFY pgrst, 'reload schema';
