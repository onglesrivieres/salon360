/*
  # Create Inventory Management System

  1. New Tables
    - `inventory_items` - Store inventory items with stock levels
    - `inventory_transactions` - Track all inventory movements (in/out)
    - `inventory_transaction_items` - Line items for each transaction

  2. Security
    - Enable RLS on all tables
    - Store-based access control for all employees
    - Manager/Owner permissions for item management
    - Multi-level approval workflow for transactions

  3. Functions
    - Generate unique transaction numbers
    - Get pending approvals for employees
    - Auto-update quantities on approval

  4. Approval Workflow
    - IN transactions: Require manager approval only
    - OUT transactions: Require both manager AND recipient approval
    - Auto-approve when all required approvals received
*/

-- Create inventory_items table
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL,
  unit text NOT NULL DEFAULT 'piece',
  quantity_on_hand numeric(10,2) NOT NULL DEFAULT 0,
  reorder_level numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, code)
);

-- Create inventory_transactions table
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('in', 'out')),
  transaction_number text NOT NULL UNIQUE,
  requested_by_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  recipient_id uuid REFERENCES public.employees(id) ON DELETE RESTRICT,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requires_recipient_approval boolean DEFAULT false,
  requires_manager_approval boolean DEFAULT true,
  recipient_approved boolean DEFAULT false,
  recipient_approved_at timestamptz,
  recipient_approved_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  manager_approved boolean DEFAULT false,
  manager_approved_at timestamptz,
  manager_approved_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  rejection_reason text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create inventory_transaction_items table
CREATE TABLE IF NOT EXISTS public.inventory_transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.inventory_transactions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_items_store_id ON public.inventory_items(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_store_id ON public.inventory_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_status ON public.inventory_transactions(status);
CREATE INDEX IF NOT EXISTS idx_inventory_transaction_items_transaction ON public.inventory_transaction_items(transaction_id);

-- Enable RLS
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transaction_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inventory_items
CREATE POLICY "Authenticated users can view inventory items at their stores"
  ON public.inventory_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_stores
      WHERE employee_stores.employee_id = auth.uid()
      AND employee_stores.store_id = inventory_items.store_id
    )
  );

CREATE POLICY "Managers can create inventory items"
  ON public.inventory_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
      AND ('Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
    )
  );

CREATE POLICY "Managers can update inventory items"
  ON public.inventory_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
      AND ('Manager' = ANY(employees.role) OR 'Owner' = ANY(employees.role))
    )
  );

-- RLS Policies for inventory_transactions
CREATE POLICY "Authenticated users can view inventory transactions at their stores"
  ON public.inventory_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_stores
      WHERE employee_stores.employee_id = auth.uid()
      AND employee_stores.store_id = inventory_transactions.store_id
    )
  );

CREATE POLICY "Authorized users can create inventory transactions"
  ON public.inventory_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
      AND (
        'Receptionist' = ANY(employees.role) OR
        'Supervisor' = ANY(employees.role) OR
        'Manager' = ANY(employees.role) OR
        'Owner' = ANY(employees.role)
      )
    )
  );

CREATE POLICY "Managers and recipients can update inventory transactions"
  ON public.inventory_transactions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.id = auth.uid()
      AND (
        'Manager' = ANY(employees.role) OR
        'Owner' = ANY(employees.role) OR
        employees.id = inventory_transactions.recipient_id
      )
    )
  );

-- RLS Policies for inventory_transaction_items
CREATE POLICY "Users can view transaction items for accessible transactions"
  ON public.inventory_transaction_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_transactions
      JOIN public.employee_stores ON employee_stores.store_id = inventory_transactions.store_id
      WHERE inventory_transactions.id = inventory_transaction_items.transaction_id
      AND employee_stores.employee_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert transaction items they create"
  ON public.inventory_transaction_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_transactions
      WHERE inventory_transactions.id = inventory_transaction_items.transaction_id
      AND inventory_transactions.requested_by_id = auth.uid()
    )
  );

-- Function to generate unique transaction number
CREATE OR REPLACE FUNCTION public.generate_inventory_transaction_number(
  p_transaction_type text,
  p_store_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_str text;
  v_prefix text;
  v_next_num integer;
  v_transaction_number text;
BEGIN
  v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  v_prefix := CASE
    WHEN p_transaction_type = 'in' THEN 'IN'
    WHEN p_transaction_type = 'out' THEN 'OUT'
    ELSE 'TXN'
  END;

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(transaction_number FROM '\\d+$') AS INTEGER
    )
  ), 0) + 1
  INTO v_next_num
  FROM public.inventory_transactions
  WHERE transaction_number LIKE v_prefix || '-' || v_date_str || '-%';

  v_transaction_number := v_prefix || '-' || v_date_str || '-' || LPAD(v_next_num::text, 4, '0');

  RETURN v_transaction_number;
END;
$$;

-- Function to get pending inventory approvals for an employee
CREATE OR REPLACE FUNCTION public.get_pending_inventory_approvals(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS TABLE (
  id uuid,
  transaction_number text,
  transaction_type text,
  requested_by_name text,
  recipient_name text,
  notes text,
  status text,
  requires_recipient_approval boolean,
  requires_manager_approval boolean,
  recipient_approved boolean,
  manager_approved boolean,
  created_at timestamptz,
  item_count bigint,
  total_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_roles text[];
  v_is_manager boolean;
BEGIN
  SELECT e.role INTO v_employee_roles
  FROM public.employees e
  WHERE e.id = p_employee_id;

  v_is_manager := 'Manager' = ANY(v_employee_roles) OR 'Owner' = ANY(v_employee_roles);

  RETURN QUERY
  SELECT
    it.id,
    it.transaction_number,
    it.transaction_type,
    req.display_name as requested_by_name,
    COALESCE(rec.display_name, '') as recipient_name,
    it.notes,
    it.status,
    it.requires_recipient_approval,
    it.requires_manager_approval,
    it.recipient_approved,
    it.manager_approved,
    it.created_at,
    COUNT(iti.id) as item_count,
    SUM(iti.quantity * iti.unit_cost) as total_value
  FROM public.inventory_transactions it
  JOIN public.employees req ON req.id = it.requested_by_id
  LEFT JOIN public.employees rec ON rec.id = it.recipient_id
  LEFT JOIN public.inventory_transaction_items iti ON iti.transaction_id = it.id
  WHERE it.store_id = p_store_id
    AND it.status = 'pending'
    AND (
      (v_is_manager AND it.requires_manager_approval AND NOT it.manager_approved)
      OR
      (it.recipient_id = p_employee_id AND it.requires_recipient_approval AND NOT it.recipient_approved)
    )
  GROUP BY it.id, it.transaction_number, it.transaction_type, req.display_name, rec.display_name,
           it.notes, it.status, it.requires_recipient_approval, it.requires_manager_approval,
           it.recipient_approved, it.manager_approved, it.created_at
  ORDER BY it.created_at DESC;
END;
$$;

-- Trigger function to update inventory quantities when transaction is approved
CREATE OR REPLACE FUNCTION public.update_inventory_quantities_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    FOR v_item IN
      SELECT item_id, quantity
      FROM public.inventory_transaction_items
      WHERE transaction_id = NEW.id
    LOOP
      IF NEW.transaction_type = 'in' THEN
        UPDATE public.inventory_items
        SET quantity_on_hand = quantity_on_hand + v_item.quantity,
            updated_at = now()
        WHERE id = v_item.item_id;
      ELSIF NEW.transaction_type = 'out' THEN
        UPDATE public.inventory_items
        SET quantity_on_hand = quantity_on_hand - v_item.quantity,
            updated_at = now()
        WHERE id = v_item.item_id;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for inventory quantity updates
DROP TRIGGER IF EXISTS trg_update_inventory_on_approval ON public.inventory_transactions;
CREATE TRIGGER trg_update_inventory_on_approval
  AFTER UPDATE ON public.inventory_transactions
  FOR EACH ROW
  WHEN (NEW.status = 'approved')
  EXECUTE FUNCTION public.update_inventory_quantities_on_approval();

-- Trigger to automatically approve transaction when all required approvals are received
CREATE OR REPLACE FUNCTION public.auto_approve_inventory_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    IF (NOT NEW.requires_manager_approval OR NEW.manager_approved)
       AND (NOT NEW.requires_recipient_approval OR NEW.recipient_approved) THEN
      NEW.status := 'approved';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_approve_inventory ON public.inventory_transactions;
CREATE TRIGGER trg_auto_approve_inventory
  BEFORE UPDATE ON public.inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_inventory_transaction();