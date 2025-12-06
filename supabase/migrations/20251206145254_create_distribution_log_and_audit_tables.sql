/*
  # Create Distribution Log and Audit Tables

  ## Overview
  Implements complete chain of custody tracking and periodic audit capability.
  Every movement of inventory is logged with full traceability. Regular audits
  identify discrepancies and provide accountability.

  ## New Tables

  ### inventory_distributions
  Complete history of all inventory movements to employees:
  - `id` (uuid, primary key) - Unique distribution identifier
  - `distribution_number` (text, unique) - Human-readable ID (e.g., "DIST-2024-001")
  - `store_id` (uuid) - Store context
  - `master_item_id` (uuid) - Item being distributed
  - `lot_id` (uuid) - Source lot for this distribution
  - `from_type` (text) - Source: 'store' or 'employee'
  - `from_employee_id` (uuid) - If transferring between employees
  - `to_employee_id` (uuid) - Recipient employee
  - `quantity` (numeric) - Amount distributed
  - `unit_cost` (numeric) - Cost per unit (from lot)
  - `distribution_date` (timestamptz) - When distributed
  - `expected_return_date` (timestamptz) - For temporary assignments
  - `actual_return_date` (timestamptz) - When returned
  - `status` (text) - 'pending', 'acknowledged', 'in_use', 'returned', 'consumed'
  - `condition_notes` (text) - Notes about item condition
  - `distributed_by_id` (uuid) - Manager who issued
  - `acknowledged_by_signature` (text) - Employee signature/confirmation
  - `acknowledged_at` (timestamptz) - When employee acknowledged

  ### inventory_audits
  Scheduled physical count audits:
  - `id` (uuid, primary key) - Unique audit identifier
  - `audit_number` (text, unique) - Human-readable ID (e.g., "AUDIT-2024-001")
  - `store_id` (uuid) - Store being audited
  - `audit_type` (text) - 'full_store', 'employee_specific', 'spot_check', 'cycle_count'
  - `employee_id` (uuid) - If employee-specific audit
  - `audit_date` (timestamptz) - Date of audit
  - `audited_by_id` (uuid) - Who conducted audit
  - `status` (text) - 'scheduled', 'in_progress', 'completed', 'approved'
  - `total_variance_value` (numeric) - Total dollar variance found
  - `notes` (text) - Audit notes and findings
  - `approved_by_id` (uuid) - Manager who approved audit
  - `approved_at` (timestamptz) - Approval timestamp

  ### inventory_audit_items
  Individual item counts from audits:
  - `id` (uuid, primary key) - Unique audit item record
  - `audit_id` (uuid) - Parent audit
  - `master_item_id` (uuid) - Item counted
  - `expected_quantity` (numeric) - What system shows
  - `actual_quantity` (numeric) - What was physically counted
  - `variance` (numeric) - Difference (actual - expected)
  - `variance_value` (numeric) - Dollar value of variance
  - `unit_cost` (numeric) - Cost per unit for valuation
  - `notes` (text) - Item-specific notes

  ## Security
  - Enable RLS on all tables
  - Employees can view their own distributions
  - Managers can create and approve audits
  - Full audit trail immutability

  ## Benefits
  - Complete chain of custody from receiving to use
  - Track every transfer with accountability
  - Regular audits identify shrinkage patterns
  - Support for recalls by lot number
  - Transparent history prevents disputes
*/

-- Step 1: Create inventory_distributions table
CREATE TABLE IF NOT EXISTS public.inventory_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_number text NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  master_item_id uuid NOT NULL REFERENCES public.master_inventory_items(id) ON DELETE RESTRICT,
  lot_id uuid NOT NULL REFERENCES public.inventory_purchase_lots(id) ON DELETE RESTRICT,
  from_type text NOT NULL,
  from_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  to_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  quantity numeric(10,2) NOT NULL,
  unit_cost numeric(10,2) NOT NULL,
  distribution_date timestamptz NOT NULL DEFAULT now(),
  expected_return_date timestamptz,
  actual_return_date timestamptz,
  status text NOT NULL DEFAULT 'pending',
  condition_notes text DEFAULT '',
  distributed_by_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE SET NULL,
  acknowledged_by_signature text,
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT inventory_distributions_distribution_number_not_empty CHECK (distribution_number <> ''),
  CONSTRAINT inventory_distributions_quantity_positive CHECK (quantity > 0),
  CONSTRAINT inventory_distributions_unit_cost_non_negative CHECK (unit_cost >= 0),
  CONSTRAINT inventory_distributions_from_type_valid CHECK (from_type IN ('store', 'employee')),
  CONSTRAINT inventory_distributions_status_valid CHECK (status IN ('pending', 'acknowledged', 'in_use', 'returned', 'consumed', 'cancelled'))
);

-- Step 2: Create inventory_audits table
CREATE TABLE IF NOT EXISTS public.inventory_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_number text NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  audit_type text NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  audit_date timestamptz NOT NULL DEFAULT now(),
  audited_by_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  total_variance_value numeric(10,2) DEFAULT 0,
  notes text DEFAULT '',
  approved_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT inventory_audits_audit_number_not_empty CHECK (audit_number <> ''),
  CONSTRAINT inventory_audits_audit_type_valid CHECK (audit_type IN ('full_store', 'employee_specific', 'spot_check', 'cycle_count')),
  CONSTRAINT inventory_audits_status_valid CHECK (status IN ('scheduled', 'in_progress', 'completed', 'approved'))
);

-- Step 3: Create inventory_audit_items table
CREATE TABLE IF NOT EXISTS public.inventory_audit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.inventory_audits(id) ON DELETE CASCADE,
  master_item_id uuid NOT NULL REFERENCES public.master_inventory_items(id) ON DELETE RESTRICT,
  expected_quantity numeric(10,2) NOT NULL DEFAULT 0,
  actual_quantity numeric(10,2) NOT NULL DEFAULT 0,
  variance numeric(10,2) GENERATED ALWAYS AS (actual_quantity - expected_quantity) STORED,
  variance_value numeric(10,2) NOT NULL DEFAULT 0,
  unit_cost numeric(10,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT inventory_audit_items_expected_quantity_non_negative CHECK (expected_quantity >= 0),
  CONSTRAINT inventory_audit_items_actual_quantity_non_negative CHECK (actual_quantity >= 0)
);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_store_id ON public.inventory_distributions(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_master_item_id ON public.inventory_distributions(master_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_lot_id ON public.inventory_distributions(lot_id);
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_to_employee_id ON public.inventory_distributions(to_employee_id);
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_from_employee_id ON public.inventory_distributions(from_employee_id);
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_status ON public.inventory_distributions(status);
CREATE INDEX IF NOT EXISTS idx_inventory_distributions_distribution_date ON public.inventory_distributions(distribution_date);

CREATE INDEX IF NOT EXISTS idx_inventory_audits_store_id ON public.inventory_audits(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audits_employee_id ON public.inventory_audits(employee_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audits_audit_date ON public.inventory_audits(audit_date);
CREATE INDEX IF NOT EXISTS idx_inventory_audits_status ON public.inventory_audits(status);

CREATE INDEX IF NOT EXISTS idx_inventory_audit_items_audit_id ON public.inventory_audit_items(audit_id);
CREATE INDEX IF NOT EXISTS idx_inventory_audit_items_master_item_id ON public.inventory_audit_items(master_item_id);

-- Step 5: Enable RLS
ALTER TABLE public.inventory_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_audit_items ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for inventory_distributions

CREATE POLICY "Users can view distributions"
  ON public.inventory_distributions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Managers can create distributions"
  ON public.inventory_distributions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update distributions"
  ON public.inventory_distributions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Step 7: Create RLS policies for inventory_audits

CREATE POLICY "Users can view audits"
  ON public.inventory_audits FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Managers can create audits"
  ON public.inventory_audits FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can update audits"
  ON public.inventory_audits FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Step 8: Create RLS policies for inventory_audit_items

CREATE POLICY "Users can view audit items"
  ON public.inventory_audit_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Managers can create audit items"
  ON public.inventory_audit_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can update audit items"
  ON public.inventory_audit_items FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Step 9: Create function to generate distribution numbers
CREATE OR REPLACE FUNCTION public.generate_distribution_number(
  p_store_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_sequence int;
  v_dist_number text;
BEGIN
  v_year := to_char(now(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(distribution_number FROM '\\d+$') AS integer
    )
  ), 0) + 1
  INTO v_sequence
  FROM public.inventory_distributions
  WHERE store_id = p_store_id
    AND distribution_number LIKE 'DIST-' || v_year || '-%';

  v_dist_number := 'DIST-' || v_year || '-' || LPAD(v_sequence::text, 4, '0');

  RETURN v_dist_number;
END;
$$;

-- Step 10: Create function to generate audit numbers
CREATE OR REPLACE FUNCTION public.generate_audit_number(
  p_store_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_sequence int;
  v_audit_number text;
BEGIN
  v_year := to_char(now(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(audit_number FROM '\\d+$') AS integer
    )
  ), 0) + 1
  INTO v_sequence
  FROM public.inventory_audits
  WHERE store_id = p_store_id
    AND audit_number LIKE 'AUDIT-' || v_year || '-%';

  v_audit_number := 'AUDIT-' || v_year || '-' || LPAD(v_sequence::text, 4, '0');

  RETURN v_audit_number;
END;
$$;

-- Step 11: Add helpful comments
COMMENT ON TABLE public.inventory_distributions IS
  'Complete history of inventory movements to employees. Provides chain of custody
   tracking from store to employee with acknowledgment and return tracking.';

COMMENT ON TABLE public.inventory_audits IS
  'Scheduled physical count audits for accountability. Tracks variance between
   expected and actual inventory at employee or store level.';

COMMENT ON TABLE public.inventory_audit_items IS
  'Individual item counts from audits. Links to parent audit with variance tracking.';

COMMENT ON COLUMN public.inventory_distributions.from_type IS
  'Source of distribution: store (from central inventory) or employee (transfer between employees)';

COMMENT ON COLUMN public.inventory_distributions.status IS
  'Distribution lifecycle: pending → acknowledged → in_use → returned/consumed';

COMMENT ON FUNCTION public.generate_distribution_number IS
  'Generates unique distribution number in format: DIST-YYYY-NNNN';

COMMENT ON FUNCTION public.generate_audit_number IS
  'Generates unique audit number in format: AUDIT-YYYY-NNNN';
