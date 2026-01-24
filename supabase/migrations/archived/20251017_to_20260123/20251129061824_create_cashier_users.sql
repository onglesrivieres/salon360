/*
  # Create Cashier Users

  1. New Employees
    - Create 3 cashier users, one for each store:
      - "Ongles Rivieres" with PIN 3333 for Ongles Rivieres store
      - "Ongles Maily" with PIN 1111 for Ongles Maily store
      - "Ongles Charlesbourg" with PIN 2222 for Ongles Charlesbourg store
    
  2. Configuration
    - Role: ['Cashier']
    - Role Permission: 'Cashier'
    - Status: 'Active'
    - PINs are hashed using bcrypt for security
    - Each cashier is linked to their respective store via employee_stores table

  3. Security
    - PINs are securely hashed using crypt() function
    - Cashiers are visible in Employee page for admin management
    - Cashiers will not appear in technician dropdowns or queues
*/

-- Insert Cashier for Ongles Rivieres (PIN: 3333)
DO $$
DECLARE
  v_employee_id uuid;
  v_store_id uuid := '090391d3-0899-4947-8735-c0bfe8dbe0e4'; -- Ongles Rivieres
BEGIN
  -- Only proceed if store exists
  IF EXISTS (SELECT 1 FROM stores WHERE id = v_store_id) THEN
    -- Check if this cashier already exists
    IF NOT EXISTS (
      SELECT 1 FROM employees
      WHERE display_name = 'Ongles Rivieres'
      AND role @> ARRAY['Cashier']::text[]
    ) THEN
      -- Insert the employee
      INSERT INTO employees (
        legal_name,
        display_name,
        role,
        role_permission,
        status,
        pin_code_hash,
        notes
      ) VALUES (
        'Ongles Rivieres',
        'Ongles Rivieres',
        ARRAY['Cashier']::text[],
        'Cashier',
        'Active',
        crypt('3333', gen_salt('bf')),
        'Cashier account for Ongles Rivieres store'
      )
      RETURNING id INTO v_employee_id;

      -- Link to store
      INSERT INTO employee_stores (employee_id, store_id)
      VALUES (v_employee_id, v_store_id);
    END IF;
  END IF;
END $$;

-- Insert Cashier for Ongles Maily (PIN: 1111)
DO $$
DECLARE
  v_employee_id uuid;
  v_store_id uuid := '37f81aae-7628-483c-9098-e56557ef2ee2'; -- Ongles Maily
BEGIN
  -- Only proceed if store exists
  IF EXISTS (SELECT 1 FROM stores WHERE id = v_store_id) THEN
    -- Check if this cashier already exists
    IF NOT EXISTS (
      SELECT 1 FROM employees
      WHERE display_name = 'Ongles Maily'
      AND role @> ARRAY['Cashier']::text[]
    ) THEN
      -- Insert the employee
      INSERT INTO employees (
        legal_name,
        display_name,
        role,
        role_permission,
        status,
        pin_code_hash,
        notes
      ) VALUES (
        'Ongles Maily',
        'Ongles Maily',
        ARRAY['Cashier']::text[],
        'Cashier',
        'Active',
        crypt('1111', gen_salt('bf')),
        'Cashier account for Ongles Maily store'
      )
      RETURNING id INTO v_employee_id;

      -- Link to store
      INSERT INTO employee_stores (employee_id, store_id)
      VALUES (v_employee_id, v_store_id);
    END IF;
  END IF;
END $$;

-- Insert Cashier for Ongles Charlesbourg (PIN: 2222)
DO $$
DECLARE
  v_employee_id uuid;
  v_store_id uuid := '198638f2-3156-41d6-955d-c4c8bc2602db'; -- Ongles Charlesbourg
BEGIN
  -- Only proceed if store exists
  IF EXISTS (SELECT 1 FROM stores WHERE id = v_store_id) THEN
    -- Check if this cashier already exists
    IF NOT EXISTS (
      SELECT 1 FROM employees
      WHERE display_name = 'Ongles Charlesbourg'
      AND role @> ARRAY['Cashier']::text[]
    ) THEN
      -- Insert the employee
      INSERT INTO employees (
        legal_name,
        display_name,
        role,
        role_permission,
        status,
        pin_code_hash,
        notes
      ) VALUES (
        'Ongles Charlesbourg',
        'Ongles Charlesbourg',
        ARRAY['Cashier']::text[],
        'Cashier',
        'Active',
        crypt('2222', gen_salt('bf')),
        'Cashier account for Ongles Charlesbourg store'
      )
      RETURNING id INTO v_employee_id;

      -- Link to store
      INSERT INTO employee_stores (employee_id, store_id)
      VALUES (v_employee_id, v_store_id);
    END IF;
  END IF;
END $$;
