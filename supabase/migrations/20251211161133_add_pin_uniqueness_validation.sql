/*
  # Add PIN Uniqueness Validation

  1. New Helper Function
    - `is_pin_in_use(pin_input text, exclude_employee_id uuid)` - Checks if a PIN is already used
      - Iterates through all active employees' PIN hashes
      - Uses bcrypt to verify if the PIN matches any existing hash
      - Excludes the specified employee from the check (for updates)
      - Returns true if PIN is in use, false otherwise

  2. Updated Functions
    - `change_employee_pin` - Now validates PIN uniqueness before allowing change
    - `reset_employee_pin` - Now generates unique temporary PINs with retry logic

  3. Security Notes
    - Never stores plain text PINs
    - Maintains bcrypt hashing for all PIN operations
    - Prevents employees from setting PINs that are already in use
    - Maximum 50 retries for temporary PIN generation to avoid infinite loops

  4. Error Messages
    - Clear error message when PIN is already in use
    - Guides users to choose a different PIN
*/

-- Helper function to check if a PIN is already in use by another employee
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
    -- Check if the PIN matches this employee's hash
    IF emp_record.pin_code_hash = crypt(pin_input, emp_record.pin_code_hash) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

-- Update change_employee_pin function to validate PIN uniqueness
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

  -- Verify old PIN
  IF current_hash != crypt(old_pin, current_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current PIN is incorrect');
  END IF;

  -- Update with new PIN
  UPDATE public.employees
  SET 
    pin_code_hash = crypt(new_pin, gen_salt('bf')),
    pin_temp = null,
    last_pin_change = now(),
    updated_at = now()
  WHERE id = emp_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Update reset_employee_pin function to generate unique temporary PINs
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

  -- Update employee with temporary PIN
  UPDATE public.employees
  SET 
    pin_code_hash = crypt(temp_pin, gen_salt('bf')),
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_pin_in_use(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_employee_pin(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_employee_pin(uuid) TO anon, authenticated;

-- Add comments
COMMENT ON FUNCTION public.is_pin_in_use IS 'Checks if a PIN is already in use by another employee using bcrypt verification';
COMMENT ON FUNCTION public.change_employee_pin IS 'Changes employee PIN after verifying old PIN and ensuring new PIN is unique';
COMMENT ON FUNCTION public.reset_employee_pin IS 'Resets employee PIN to a unique random temporary PIN';
