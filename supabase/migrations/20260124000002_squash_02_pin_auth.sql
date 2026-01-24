/*
  # Squashed Migration: PIN Authentication

  ## Overview
  This migration consolidates 16+ PIN-related migrations that establish
  the bcrypt-based PIN authentication system.

  ## Functions Created
  - verify_employee_pin: Login verification
  - set_employee_pin: Set specific PIN for employee
  - change_employee_pin: User changes their own PIN
  - reset_employee_pin: Admin resets PIN to random temp
  - is_pin_in_use: Helper for uniqueness validation

  ## Key Features
  - 4-digit PIN codes with bcrypt hashing
  - PIN uniqueness across all employees
  - Temporary PIN support for resets
  - Case-insensitive status checking
*/

-- ============================================================================
-- FUNCTION: is_pin_in_use (Helper for uniqueness)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_pin_in_use(
  pin_input text,
  exclude_employee_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  emp_record RECORD;
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^\d{4}$' THEN
    RETURN false;
  END IF;

  -- Check if PIN matches any existing employee's hash
  FOR emp_record IN
    SELECT id, pin_code_hash
    FROM public.employees
    WHERE status = 'Active'
      AND pin_code_hash IS NOT NULL
      AND (exclude_employee_id IS NULL OR id != exclude_employee_id)
  LOOP
    IF emp_record.pin_code_hash = extensions.crypt(pin_input, emp_record.pin_code_hash) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_pin_in_use(text, uuid) TO anon, authenticated;
COMMENT ON FUNCTION public.is_pin_in_use IS 'Checks if a PIN is already in use by another employee using bcrypt verification';

-- ============================================================================
-- FUNCTION: verify_employee_pin (Login verification)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.verify_employee_pin(pin_input text)
RETURNS TABLE (
  employee_id uuid,
  display_name text,
  role text[],
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
    e.can_reset_pin,
    NULL::uuid as store_id
  FROM public.employees e
  WHERE LOWER(e.status) = 'active'
    AND e.pin_code_hash IS NOT NULL
    AND e.pin_code_hash = extensions.crypt(pin_input, e.pin_code_hash)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_employee_pin(text) TO anon, authenticated;
COMMENT ON FUNCTION public.verify_employee_pin IS 'Verifies employee PIN using bcrypt and returns session data if valid';

-- ============================================================================
-- FUNCTION: set_employee_pin (Set specific PIN)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_employee_pin(emp_id uuid, new_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  -- Validate PIN is exactly 4 digits
  IF new_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  -- Check if PIN is already in use
  IF public.is_pin_in_use(new_pin, emp_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This PIN is already in use by another employee');
  END IF;

  -- Update employee with new PIN
  UPDATE public.employees
  SET
    pin_code_hash = extensions.crypt(new_pin, extensions.gen_salt('bf')),
    pin_temp = NULL,
    last_pin_change = now(),
    updated_at = now()
  WHERE id = emp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_employee_pin(uuid, text) TO anon, authenticated;
COMMENT ON FUNCTION public.set_employee_pin IS 'Sets a specific 4-digit PIN for an employee';

-- ============================================================================
-- FUNCTION: change_employee_pin (User changes own PIN)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.change_employee_pin(
  emp_id uuid,
  old_pin text,
  new_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_hash text;
BEGIN
  -- Validate new PIN format
  IF new_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'New PIN must be exactly 4 digits');
  END IF;

  -- Check if old and new PINs are the same
  IF old_pin = new_pin THEN
    RETURN jsonb_build_object('success', false, 'error', 'New PIN must be different from old PIN');
  END IF;

  -- Check if new PIN is already in use by another employee
  IF public.is_pin_in_use(new_pin, emp_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This PIN is already in use by another employee. Please choose a different PIN.');
  END IF;

  -- Get current PIN hash
  SELECT pin_code_hash INTO current_hash
  FROM public.employees
  WHERE id = emp_id;

  IF current_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Verify old PIN
  IF current_hash != extensions.crypt(old_pin, current_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current PIN is incorrect');
  END IF;

  -- Update with new PIN
  UPDATE public.employees
  SET
    pin_code_hash = extensions.crypt(new_pin, extensions.gen_salt('bf')),
    pin_temp = null,
    last_pin_change = now(),
    updated_at = now()
  WHERE id = emp_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.change_employee_pin(uuid, text, text) TO anon, authenticated;
COMMENT ON FUNCTION public.change_employee_pin IS 'Changes employee PIN after verifying old PIN and ensuring new PIN is unique';

-- ============================================================================
-- FUNCTION: reset_employee_pin (Admin resets PIN)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reset_employee_pin(emp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  temp_pin text;
  max_attempts int := 50;
  attempt_count int := 0;
BEGIN
  -- Generate random 4-digit PIN until we find a unique one
  LOOP
    temp_pin := lpad(floor(random() * 10000)::text, 4, '0');

    -- Check if this PIN is already in use by another employee
    IF NOT public.is_pin_in_use(temp_pin, emp_id) THEN
      EXIT;
    END IF;

    attempt_count := attempt_count + 1;

    IF attempt_count >= max_attempts THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unable to generate unique PIN. Please try again.');
    END IF;
  END LOOP;

  -- Update employee with temporary PIN
  UPDATE public.employees
  SET
    pin_code_hash = extensions.crypt(temp_pin, extensions.gen_salt('bf')),
    pin_temp = temp_pin,
    last_pin_change = now(),
    updated_at = now()
  WHERE id = emp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'temp_pin', temp_pin);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_employee_pin(uuid) TO anon, authenticated;
COMMENT ON FUNCTION public.reset_employee_pin IS 'Resets employee PIN to a unique random temporary PIN';

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
