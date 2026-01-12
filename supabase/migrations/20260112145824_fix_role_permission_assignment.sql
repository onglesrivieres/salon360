/*
  # Fix Role Permission Assignment Bug

  ## Problem
  The original migration (20251020070519_add_role_permissions.sql) used scalar
  comparison on the `role` column which is a text[] array. This caused incorrect
  role_permission values to be assigned.

  Example of the bug:
    WHEN role IN ('Manager', 'Owner') THEN 'Admin'  -- Never matches ['Manager']
    WHEN role = 'Receptionist' THEN 'Receptionist'  -- Never matches ['Receptionist']

  ## Solution
  Use ANY() for proper array element matching.

  ## Impact
  - Employees with Admin/Manager/Owner in their role array will get role_permission = 'Admin'
  - Employees with Receptionist in their role array (but no admin roles) will get role_permission = 'Receptionist'
  - This fixes the issue where Admins were blocked outside working hours due to incorrect role_permission
*/

-- Fix Admin permissions: Anyone with Admin, Manager, or Owner role should have Admin permission
UPDATE employees
SET role_permission = 'Admin'
WHERE role_permission != 'Admin'
  AND ('Admin' = ANY(role) OR 'Manager' = ANY(role) OR 'Owner' = ANY(role));

-- Fix Receptionist permissions: Anyone with Receptionist role (but no admin roles) should have Receptionist permission
UPDATE employees
SET role_permission = 'Receptionist'
WHERE role_permission = 'Technician'
  AND 'Receptionist' = ANY(role)
  AND NOT ('Admin' = ANY(role) OR 'Manager' = ANY(role) OR 'Owner' = ANY(role));
