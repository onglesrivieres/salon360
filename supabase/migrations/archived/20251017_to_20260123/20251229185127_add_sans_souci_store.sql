/*
  # Add Sans Souci Store

  ## Overview
  Adds the fourth store location "Sans Souci" to the multi-store system.

  ## Changes
  1. Insert new store record
     - Name: "Sans Souci"
     - Code: "SS"
     - Active: true

  2. Configure opening hours
     - Monday-Friday: 10:00 AM
     - Saturday: 09:00 AM
     - Sunday: 10:00 AM

  3. Configure closing hours
     - Monday-Wednesday: 19:00 (7:00 PM)
     - Thursday-Friday: 21:00 (9:00 PM)
     - Saturday: 19:00 (7:00 PM)
     - Sunday: 18:00 (6:00 PM)

  ## Security
  - Uses existing RLS policies on stores table
  - Store will be visible to all authenticated users
  - Admin users can manage store through existing policies
*/

-- Insert Sans Souci store
INSERT INTO stores (name, code, active) VALUES
  ('Sans Souci', 'SS', true)
ON CONFLICT (code) DO NOTHING;

-- Configure opening hours for Sans Souci
UPDATE stores
SET opening_hours = jsonb_build_object(
  'monday', '10:00:00',
  'tuesday', '10:00:00',
  'wednesday', '10:00:00',
  'thursday', '10:00:00',
  'friday', '10:00:00',
  'saturday', '09:00:00',
  'sunday', '10:00:00'
)
WHERE code = 'SS';

-- Configure closing hours for Sans Souci
UPDATE stores
SET closing_hours = jsonb_build_object(
  'monday', '19:00:00',
  'tuesday', '19:00:00',
  'wednesday', '19:00:00',
  'thursday', '21:00:00',
  'friday', '21:00:00',
  'saturday', '19:00:00',
  'sunday', '18:00:00'
)
WHERE code = 'SS';

-- Verify the insertion
SELECT * FROM stores WHERE code = 'SS';
