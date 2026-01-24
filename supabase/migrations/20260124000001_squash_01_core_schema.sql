/*
  # Squashed Migration: Core Schema

  ## Overview
  This migration consolidates 50+ migrations from Oct-Jan 2026 that establish
  the core database schema for the Salon360 application.

  ## Tables Created
  - stores: Multi-store configuration
  - employees: Employee records with roles and settings
  - employee_stores: Junction table for multi-store employee assignments
  - services: Global service catalog
  - sale_tickets: Customer tickets/transactions
  - ticket_items: Line items for each ticket
  - ticket_activity_log: Audit trail for ticket changes

  ## Key Features
  - Multi-store support with employee_stores junction
  - Role array support (employees can have multiple roles)
  - Complete ticket lifecycle tracking
  - Activity logging for audit trails
*/

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLE: stores
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  active boolean DEFAULT true NOT NULL,
  closing_hours jsonb,
  is_headquarters boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stores_code ON public.stores(code);
CREATE INDEX IF NOT EXISTS idx_stores_active ON public.stores(active);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view active stores" ON public.stores;
CREATE POLICY "Users can view active stores"
  ON public.stores FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can manage stores" ON public.stores;
CREATE POLICY "Admins can manage stores"
  ON public.stores FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: employees
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  display_name text NOT NULL,
  role text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'Active',
  notes text DEFAULT '',
  pin_code_hash text,
  can_reset_pin boolean DEFAULT false,
  pin_temp text,
  last_pin_change timestamptz,
  store_id uuid REFERENCES public.stores(id),
  pay_type text,
  count_ot boolean DEFAULT true,
  weekly_schedule jsonb,
  tip_report_show_details boolean DEFAULT true,
  tip_paired_enabled boolean DEFAULT true,
  attendance_display boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT employees_role_not_empty CHECK (array_length(role, 1) > 0),
  CONSTRAINT employees_role_valid CHECK (role <@ ARRAY['Technician', 'Receptionist', 'Manager', 'Owner', 'Supervisor', 'Cashier', 'Spa Expert', 'Admin']::text[]),
  CONSTRAINT employees_pay_type_valid CHECK (pay_type IS NULL OR pay_type IN ('hourly', 'daily', 'commission'))
);

CREATE INDEX IF NOT EXISTS idx_employees_store_id ON public.employees(store_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to employees" ON public.employees;
CREATE POLICY "Allow all access to employees"
  ON public.employees FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: employee_stores (junction table for multi-store support)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_stores (
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (employee_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_stores_employee_id ON public.employee_stores(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_stores_store_id ON public.employee_stores(store_id);

ALTER TABLE public.employee_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow view employee stores" ON public.employee_stores;
CREATE POLICY "Allow view employee stores"
  ON public.employee_stores FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow insert employee stores" ON public.employee_stores;
CREATE POLICY "Allow insert employee stores"
  ON public.employee_stores FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow delete employee stores" ON public.employee_stores;
CREATE POLICY "Allow delete employee stores"
  ON public.employee_stores FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================================
-- TABLE: services (global service catalog)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  base_price numeric(10,2) NOT NULL DEFAULT 0.00,
  duration_min integer DEFAULT 30,
  category text DEFAULT 'General',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_code ON public.services(code);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(active);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to services" ON public.services;
CREATE POLICY "Allow all access to services"
  ON public.services FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: clients
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone_number text NOT NULL,
  notes text DEFAULT '',
  is_blacklisted boolean DEFAULT false,
  blacklist_reason text,
  blacklist_date timestamptz,
  blacklisted_by uuid REFERENCES public.employees(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_clients_store_id ON public.clients(store_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone_number ON public.clients(phone_number);
CREATE INDEX IF NOT EXISTS idx_clients_is_blacklisted ON public.clients(is_blacklisted);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to clients" ON public.clients;
CREATE POLICY "Allow all access to clients"
  ON public.clients FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: sale_tickets
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sale_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text UNIQUE NOT NULL,
  ticket_date date NOT NULL DEFAULT CURRENT_DATE,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.employees(id),
  customer_name text DEFAULT '',
  customer_phone text DEFAULT '',
  customer_type text,
  payment_method text DEFAULT 'Cash',
  total numeric(10,2) DEFAULT 0.00,
  location text DEFAULT '',
  notes text DEFAULT '',
  store_id uuid REFERENCES public.stores(id),
  created_by uuid REFERENCES public.employees(id),
  saved_by uuid REFERENCES public.employees(id),
  closed_by uuid REFERENCES public.employees(id),
  closed_by_roles jsonb DEFAULT '[]'::jsonb,
  client_id uuid REFERENCES public.clients(id),
  -- Approval fields
  approval_status text,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.employees(id),
  approval_deadline timestamptz,
  approval_required_level text DEFAULT 'technician',
  approval_reason text,
  approval_performer_id uuid,
  rejection_reason text,
  requires_higher_approval boolean DEFAULT false,
  requires_admin_review boolean DEFAULT false,
  performed_and_closed_by_same_person boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_tickets_ticket_date ON public.sale_tickets(ticket_date);
CREATE INDEX IF NOT EXISTS idx_sale_tickets_closed_at ON public.sale_tickets(closed_at);
CREATE INDEX IF NOT EXISTS idx_sale_tickets_store_id ON public.sale_tickets(store_id);
CREATE INDEX IF NOT EXISTS idx_sale_tickets_approval_status ON public.sale_tickets(approval_status);
CREATE INDEX IF NOT EXISTS idx_sale_tickets_approval_deadline ON public.sale_tickets(approval_deadline);
CREATE INDEX IF NOT EXISTS idx_sale_tickets_requires_admin_review ON public.sale_tickets(requires_admin_review);
CREATE INDEX IF NOT EXISTS idx_sale_tickets_created_by ON public.sale_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_sale_tickets_saved_by ON public.sale_tickets(saved_by);
CREATE INDEX IF NOT EXISTS idx_sale_tickets_closed_by ON public.sale_tickets(closed_by);
CREATE INDEX IF NOT EXISTS idx_sale_tickets_approved_by ON public.sale_tickets(approved_by);
CREATE INDEX IF NOT EXISTS idx_sale_tickets_client_id ON public.sale_tickets(client_id);

ALTER TABLE public.sale_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to sale_tickets" ON public.sale_tickets;
CREATE POLICY "Allow all access to sale_tickets"
  ON public.sale_tickets FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: ticket_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ticket_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_ticket_id uuid NOT NULL REFERENCES public.sale_tickets(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE RESTRICT,
  store_service_id uuid,
  custom_service_name text,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  qty numeric(10,2) DEFAULT 1.00,
  price_each numeric(10,2) NOT NULL DEFAULT 0.00,
  tip_customer_cash numeric(10,2) DEFAULT 0.00,
  tip_customer_card numeric(10,2) DEFAULT 0.00,
  tip_receptionist numeric(10,2) DEFAULT 0.00,
  addon_details text DEFAULT '',
  addon_price numeric(10,2) DEFAULT 0.00,
  discount_percentage numeric DEFAULT 0.00,
  discount_amount numeric DEFAULT 0.00,
  discount_percentage_cash numeric DEFAULT 0.00,
  discount_amount_cash numeric DEFAULT 0.00,
  payment_cash decimal(10,2) DEFAULT 0 NOT NULL,
  payment_card decimal(10,2) DEFAULT 0 NOT NULL,
  payment_gift_card decimal(10,2) DEFAULT 0 NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.employees(id),
  timer_stopped_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT discount_percentage_range CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT discount_amount_non_negative CHECK (discount_amount >= 0),
  CONSTRAINT discount_percentage_cash_range CHECK (discount_percentage_cash >= 0 AND discount_percentage_cash <= 100),
  CONSTRAINT discount_amount_cash_non_negative CHECK (discount_amount_cash >= 0),
  CONSTRAINT payment_cash_non_negative CHECK (payment_cash >= 0),
  CONSTRAINT payment_card_non_negative CHECK (payment_card >= 0),
  CONSTRAINT payment_gift_card_non_negative CHECK (payment_gift_card >= 0)
);

CREATE INDEX IF NOT EXISTS idx_ticket_items_sale_ticket_id ON public.ticket_items(sale_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_items_employee_id ON public.ticket_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_ticket_items_service_id ON public.ticket_items(service_id);
CREATE INDEX IF NOT EXISTS idx_ticket_items_store_service_id ON public.ticket_items(store_service_id);
CREATE INDEX IF NOT EXISTS idx_ticket_items_completed_at ON public.ticket_items(completed_at);
CREATE INDEX IF NOT EXISTS idx_ticket_items_started_at ON public.ticket_items(started_at);

ALTER TABLE public.ticket_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to ticket_items" ON public.ticket_items;
CREATE POLICY "Allow all access to ticket_items"
  ON public.ticket_items FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: ticket_activity_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ticket_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.sale_tickets(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id),
  action text NOT NULL CHECK (action IN ('created', 'updated', 'closed', 'reopened', 'approved', 'status_corrected', 'deleted')),
  description text NOT NULL,
  changes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_activity_log_ticket_id ON public.ticket_activity_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_log_created_at ON public.ticket_activity_log(created_at DESC);

ALTER TABLE public.ticket_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to ticket_activity_log" ON public.ticket_activity_log;
CREATE POLICY "Allow all access to ticket_activity_log"
  ON public.ticket_activity_log FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get store timezone
CREATE OR REPLACE FUNCTION public.get_store_timezone(p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone text;
BEGIN
  SELECT setting_value #>> '{}' INTO v_timezone
  FROM public.app_settings
  WHERE store_id = p_store_id
    AND setting_key = 'timezone';

  RETURN COALESCE(v_timezone, 'America/New_York');
END;
$$;

-- Check employee store access
CREATE OR REPLACE FUNCTION public.check_employee_store_access(
  p_employee_id uuid,
  p_store_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employee_stores
    WHERE employee_id = p_employee_id
      AND store_id = p_store_id
  );
END;
$$;

-- Check if all ticket services are completed
CREATE OR REPLACE FUNCTION public.check_ticket_all_services_completed(p_ticket_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.ticket_items
    WHERE sale_ticket_id = p_ticket_id
      AND completed_at IS NULL
  );
END;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
