/*
  # Add Closing Hours to Stores Table

  ## Overview
  Adds a `closing_hours` JSONB column to the `stores` table to store day-specific closing times.
  This enables flexible, store-specific closing time management for accurate auto-checkout functionality.

  ## Changes
  1. Add `closing_hours` JSONB column to `stores` table
     - Structure: { "monday": "17:30:00", "tuesday": "17:30:00", ... }
  
  2. Populate closing hours for existing stores
     - Ongles Rivière-du-Loup (RIVIERES): Mon-Wed: 17:30, Thurs-Fri: 21:00, Sat-Sun: 17:00
     - Ongles Maily (MAILY): Mon-Wed: 17:30, Thurs-Fri: 19:00, Sat-Sun: 17:00
     - Ongles Charlesbourg (CHARLESBOURG): All days: 17:00

  ## Security
  - Column is added to existing table with RLS already enabled
  - No new security risks introduced
*/

-- Add closing_hours JSONB column to stores table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'closing_hours'
  ) THEN
    ALTER TABLE stores ADD COLUMN closing_hours jsonb;
  END IF;
END $$;

-- Update closing hours for Ongles Rivieres
-- Mon-Wed: 17:30, Thurs-Fri: 21:00, Sat-Sun: 17:00
UPDATE stores 
SET closing_hours = jsonb_build_object(
  'monday', '17:30:00',
  'tuesday', '17:30:00',
  'wednesday', '17:30:00',
  'thursday', '21:00:00',
  'friday', '21:00:00',
  'saturday', '17:00:00',
  'sunday', '17:00:00'
)
WHERE code = 'RIVIERES';

-- Update closing hours for Ongles Maily
-- Mon-Wed: 17:30, Thurs-Fri: 19:00, Sat-Sun: 17:00
UPDATE stores 
SET closing_hours = jsonb_build_object(
  'monday', '17:30:00',
  'tuesday', '17:30:00',
  'wednesday', '17:30:00',
  'thursday', '19:00:00',
  'friday', '19:00:00',
  'saturday', '17:00:00',
  'sunday', '17:00:00'
)
WHERE code = 'MAILY';

-- Update closing hours for Ongles Charlesbourg
-- Default to 17:00 for all days
UPDATE stores 
SET closing_hours = jsonb_build_object(
  'monday', '17:00:00',
  'tuesday', '17:00:00',
  'wednesday', '17:00:00',
  'thursday', '17:00:00',
  'friday', '17:00:00',
  'saturday', '17:00:00',
  'sunday', '17:00:00'
)
WHERE code = 'CHARLESBOURG';
