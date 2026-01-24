/*
  # Fix PIN Uniqueness Validation Schema References

  1. Issue
    - The migration `20251211161133_add_pin_uniqueness_validation.sql` uses `crypt()` and `gen_salt()`
      without the `extensions.` schema prefix
    - This causes the error: "function crypt(text, text) does not exist"
    - The pgcrypto extension functions must be called as `extensions.crypt()` and `extensions.gen_salt()`

  2. Changes
    - Update `is_pin_in_use` function to use `extensions.crypt()`
    - Update `change_employee_pin` function to use `extensions.crypt()` and `extensions.gen_salt()`
    - Update `reset_employee_pin` function to use `extensions.crypt()` and `extensions.gen_salt()`

  3. Security
    - All functions maintain SECURITY DEFINER
    - All functions maintain search_path = public
    - All permissions remain the same (anon, authenticated)
*/

-- Update is_pin_in_use function with proper schema references
CREATE OR REPLACE FUNCTION public.is_pin_in_use(
  pin_input text,
  exclude_employee_id uuid DEFAULT NULL
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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
    -- Check if the PIN matches this employee's hash (FIXED: added extensions. prefix)
    IF emp_record.pin_code_hash = extensions.crypt(pin_input, emp_record.pin_code_hash) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

-- Update change_employee_pin function with proper schema references
CREATE OR REPLACE FUNCTION public.change_employee_pin(
  emp_id uuid,
  old_pin text,
  new_pin text
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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

  -- Verify old PIN (FIXED: added extensions. prefix)
  IF current_hash != extensions.crypt(old_pin, current_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current PIN is incorrect');
  END IF;

  -- Update with new PIN (FIXED: added extensions. prefix to both crypt and gen_salt)
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

-- Update reset_employee_pin function with proper schema references
CREATE OR REPLACE FUNCTION public.reset_employee_pin(emp_id uuid)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
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
      EXIT; -- Found a unique PIN, exit the loop
    END IF;

    attempt_count := attempt_count + 1;

    -- Safety check to avoid infinite loop
    IF attempt_count >= max_attempts THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unable to generate unique PIN. Please try again.');
    END IF;
  END LOOP;

  -- Update employee with temporary PIN (FIXED: added extensions. prefix to both crypt and gen_salt)
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

-- Grant execute permissions (no changes needed)
GRANT EXECUTE ON FUNCTION public.is_pin_in_use(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_employee_pin(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_employee_pin(uuid) TO anon, authenticated;

-- Add comments
COMMENT ON FUNCTION public.is_pin_in_use IS 'Checks if a PIN is already in use by another employee using bcrypt verification (with proper extensions schema references)';
COMMENT ON FUNCTION public.change_employee_pin IS 'Changes employee PIN after verifying old PIN and ensuring new PIN is unique (with proper extensions schema references)';
COMMENT ON FUNCTION public.reset_employee_pin IS 'Resets employee PIN to a unique random temporary PIN (with proper extensions schema references)';
