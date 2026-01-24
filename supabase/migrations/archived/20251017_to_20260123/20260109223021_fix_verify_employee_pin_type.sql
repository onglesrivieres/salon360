/*
  # Fix verify_employee_pin Function Type Mismatch

  ## Problem
  The function returns `role_permission text` but the database column
  `employees.role_permission` is type `role_permission_type` (enum).
  This causes a type mismatch error when trying to log in.

  ## Solution
  Cast the enum to text in the SELECT statement.
*/

CREATE OR REPLACE FUNCTION public.verify_employee_pin(pin_input text)
RETURNS TABLE (
  employee_id uuid,
  display_name text,
  role text[],
  role_permission text,
  can_reset_pin boolean,
  store_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id as employee_id,
    e.display_name,
    e.role,
    e.role_permission::text,  -- Cast enum to text
    e.can_reset_pin,
    NULL::uuid as store_id
  FROM employees e
  WHERE LOWER(e.status) = 'active'
    AND e.pin_code_hash IS NOT NULL
    AND e.pin_code_hash = extensions.crypt(pin_input, e.pin_code_hash)
  LIMIT 1;
END;
$$;
