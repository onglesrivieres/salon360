/*
  # Update Store Operating Hours

  Updates the opening and closing hours for all three stores based on their current schedules.

  ## Changes
  - Ongles Maily (OM): Thu-Fri closing changed from 19:00 to 21:00
  - Ongles Charlesbourg (OC): Mon-Wed closing changed from 17:00 to 17:30, Thu-Fri closing changed from 17:00 to 20:00
  - Ongles Rivières (OR): Mon-Wed opening changed from 09:00 to 09:30
*/

-- Update Ongles Maily (OM)
-- Opening: Mon-Sat 09:00, Sun 10:00
-- Closing: Mon-Wed 17:30, Thu-Fri 21:00, Sat-Sun 17:00
UPDATE stores
SET
  opening_hours = jsonb_build_object(
    'monday', '09:00:00',
    'tuesday', '09:00:00',
    'wednesday', '09:00:00',
    'thursday', '09:00:00',
    'friday', '09:00:00',
    'saturday', '09:00:00',
    'sunday', '10:00:00'
  ),
  closing_hours = jsonb_build_object(
    'monday', '17:30:00',
    'tuesday', '17:30:00',
    'wednesday', '17:30:00',
    'thursday', '21:00:00',
    'friday', '21:00:00',
    'saturday', '17:00:00',
    'sunday', '17:00:00'
  ),
  updated_at = now()
WHERE code = 'OM';

-- Update Ongles Charlesbourg (OC)
-- Opening: Mon-Sat 09:00, Sun 10:00
-- Closing: Mon-Wed 17:30, Thu-Fri 20:00, Sat-Sun 17:00
UPDATE stores
SET
  opening_hours = jsonb_build_object(
    'monday', '09:00:00',
    'tuesday', '09:00:00',
    'wednesday', '09:00:00',
    'thursday', '09:00:00',
    'friday', '09:00:00',
    'saturday', '09:00:00',
    'sunday', '10:00:00'
  ),
  closing_hours = jsonb_build_object(
    'monday', '17:30:00',
    'tuesday', '17:30:00',
    'wednesday', '17:30:00',
    'thursday', '20:00:00',
    'friday', '20:00:00',
    'saturday', '17:00:00',
    'sunday', '17:00:00'
  ),
  updated_at = now()
WHERE code = 'OC';

-- Update Ongles Rivières (OR)
-- Opening: Mon-Wed 09:30, Thu-Sat 09:00, Sun 10:00
-- Closing: Mon-Wed 17:30, Thu-Fri 21:00, Sat-Sun 17:00
UPDATE stores
SET
  opening_hours = jsonb_build_object(
    'monday', '09:30:00',
    'tuesday', '09:30:00',
    'wednesday', '09:30:00',
    'thursday', '09:00:00',
    'friday', '09:00:00',
    'saturday', '09:00:00',
    'sunday', '10:00:00'
  ),
  closing_hours = jsonb_build_object(
    'monday', '17:30:00',
    'tuesday', '17:30:00',
    'wednesday', '17:30:00',
    'thursday', '21:00:00',
    'friday', '21:00:00',
    'saturday', '17:00:00',
    'sunday', '17:00:00'
  ),
  updated_at = now()
WHERE code = 'OR';
