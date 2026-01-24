/*
  # Squashed Migration: Store Services

  ## Overview
  This migration consolidates store services migrations for per-store
  service customization and employee service assignments.

  ## Tables Created
  - store_services: Per-store service definitions
  - store_service_categories: Custom categories per store
  - employee_services: Employee to service assignments

  ## Functions Created
  - get_services_by_popularity: Services sorted by usage
*/

-- ============================================================================
-- TABLE: store_services
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.store_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id),
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  base_price numeric(10,2) NOT NULL DEFAULT 0.00,
  price numeric(10,2) NOT NULL DEFAULT 0.00,
  duration_min integer NOT NULL DEFAULT 30,
  active boolean DEFAULT true,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, code)
);

CREATE INDEX IF NOT EXISTS idx_store_services_store_id ON public.store_services(store_id);
CREATE INDEX IF NOT EXISTS idx_store_services_service_id ON public.store_services(service_id);
CREATE INDEX IF NOT EXISTS idx_store_services_code ON public.store_services(code);
CREATE INDEX IF NOT EXISTS idx_store_services_active ON public.store_services(store_id, active);
CREATE INDEX IF NOT EXISTS idx_store_services_category ON public.store_services(store_id, category);

ALTER TABLE public.store_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to store_services" ON public.store_services;
CREATE POLICY "Allow all access to store_services"
  ON public.store_services FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Add foreign key from ticket_items to store_services
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_items_store_service_id_fkey'
  ) THEN
    ALTER TABLE public.ticket_items
    ADD CONSTRAINT ticket_items_store_service_id_fkey
    FOREIGN KEY (store_service_id) REFERENCES public.store_services(id);
  END IF;
END $$;

-- ============================================================================
-- TABLE: store_service_categories
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.store_service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'pink',
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT store_service_categories_name_not_empty CHECK (name <> ''),
  CONSTRAINT store_service_categories_unique_name UNIQUE (store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_store_service_categories_store_id ON public.store_service_categories(store_id);
CREATE INDEX IF NOT EXISTS idx_store_service_categories_store_active ON public.store_service_categories(store_id, is_active) WHERE is_active = true;

ALTER TABLE public.store_service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to store_service_categories" ON public.store_service_categories;
CREATE POLICY "Allow all access to store_service_categories"
  ON public.store_service_categories FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_store_service_categories_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_store_service_categories_updated_at ON public.store_service_categories;
CREATE TRIGGER trigger_store_service_categories_updated_at
  BEFORE UPDATE ON public.store_service_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_store_service_categories_updated_at();

-- ============================================================================
-- TABLE: employee_services
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.employee_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT employee_services_unique UNIQUE (employee_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_services_employee_id ON public.employee_services(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_services_service_id ON public.employee_services(service_id);

ALTER TABLE public.employee_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to employee_services" ON public.employee_services;
CREATE POLICY "Allow all access to employee_services"
  ON public.employee_services FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- FUNCTION: get_services_by_popularity
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_services_by_popularity(p_store_id uuid)
RETURNS TABLE (
  id uuid,
  store_service_id uuid,
  code text,
  name text,
  price numeric,
  duration_min integer,
  category text,
  active boolean,
  archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  usage_count numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'p_store_id parameter is required';
  END IF;

  RETURN QUERY
  WITH service_usage AS (
    SELECT
      ti.store_service_id,
      SUM(ti.qty) as total_usage
    FROM public.ticket_items ti
    JOIN public.sale_tickets st ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND ti.store_service_id IS NOT NULL
    GROUP BY ti.store_service_id
  )
  SELECT
    ss.id as id,
    ss.id as store_service_id,
    ss.code as code,
    ss.name as name,
    ss.price as price,
    ss.duration_min as duration_min,
    ss.category as category,
    ss.active as active,
    COALESCE(ss.archived, false) as archived,
    ss.created_at as created_at,
    ss.updated_at as updated_at,
    COALESCE(su.total_usage, 0) as usage_count
  FROM public.store_services ss
  LEFT JOIN service_usage su ON ss.id = su.store_service_id
  WHERE ss.store_id = p_store_id
    AND ss.active = true
    AND COALESCE(ss.archived, false) = false
  ORDER BY
    COALESCE(su.total_usage, 0) DESC,
    ss.code ASC;
END;
$$;

COMMENT ON FUNCTION public.get_services_by_popularity(uuid) IS 'Returns store-specific services sorted by popularity (usage count)';

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
