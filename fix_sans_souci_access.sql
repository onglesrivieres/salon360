/*
  Fix Sans Souci Store Access for Admin User

  This script will:
  1. Insert the Sans Souci store (if it doesn't exist)
  2. Configure opening and closing hours
  3. Assign all admin users to the Sans Souci store
  4. Initialize app settings for the new store

  Run this in your Supabase SQL Editor to bypass RLS
*/

-- Step 1: Insert Sans Souci store
INSERT INTO stores (name, code, active) VALUES
  ('Sans Souci', 'SS', true)
ON CONFLICT (code) DO NOTHING;

-- Step 2: Configure opening hours for Sans Souci
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

-- Step 3: Configure closing hours for Sans Souci
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

-- Step 4: Assign all admin users to Sans Souci store
INSERT INTO employee_stores (employee_id, store_id)
SELECT
  e.id AS employee_id,
  s.id AS store_id
FROM employees e
CROSS JOIN stores s
WHERE s.code = 'SS'
  AND 'Admin' = ANY(e.roles)
  AND NOT EXISTS (
    SELECT 1 FROM employee_stores es
    WHERE es.employee_id = e.id AND es.store_id = s.id
  );

-- Step 5: Initialize app settings for Sans Souci
-- (These are the critical settings needed for the store to function)
INSERT INTO app_settings (store_id, setting_key, setting_value, value_type)
SELECT
  s.id,
  'auto_approval_minutes',
  '15',
  'number'
FROM stores s
WHERE s.code = 'SS'
ON CONFLICT (store_id, setting_key) DO NOTHING;

INSERT INTO app_settings (store_id, setting_key, setting_value, value_type)
SELECT
  s.id,
  'manager_approval_minutes',
  '5',
  'number'
FROM stores s
WHERE s.code = 'SS'
ON CONFLICT (store_id, setting_key) DO NOTHING;

INSERT INTO app_settings (store_id, setting_key, setting_value, value_type)
SELECT
  s.id,
  'high_tip_threshold',
  '50',
  'number'
FROM stores s
WHERE s.code = 'SS'
ON CONFLICT (store_id, setting_key) DO NOTHING;

INSERT INTO app_settings (store_id, setting_key, setting_value, value_type)
SELECT
  s.id,
  'require_high_tip_approval',
  'true',
  'boolean'
FROM stores s
WHERE s.code = 'SS'
ON CONFLICT (store_id, setting_key) DO NOTHING;

-- Step 6: Verify the setup
SELECT
  'Sans Souci Store Created' AS status,
  s.id,
  s.name,
  s.code,
  s.active,
  s.opening_hours,
  s.closing_hours
FROM stores s
WHERE s.code = 'SS';

-- Show admin users assigned to Sans Souci
SELECT
  'Admin Users Assigned to Sans Souci' AS status,
  e.display_name,
  e.employee_code,
  s.name AS store_name
FROM employee_stores es
JOIN employees e ON es.employee_id = e.id
JOIN stores s ON es.store_id = s.id
WHERE s.code = 'SS'
  AND 'Admin' = ANY(e.roles);
