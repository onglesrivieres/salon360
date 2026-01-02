import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migrationSQL = `
-- Create safe_balance_history table
CREATE TABLE IF NOT EXISTS public.safe_balance_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  opening_balance decimal(10, 2) NOT NULL DEFAULT 0,
  closing_balance decimal(10, 2) NOT NULL DEFAULT 0,
  total_deposits decimal(10, 2) NOT NULL DEFAULT 0,
  total_withdrawals decimal(10, 2) NOT NULL DEFAULT 0,
  created_by_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  updated_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_store_date UNIQUE (store_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_safe_balance_store_date ON public.safe_balance_history(store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_safe_balance_store_id ON public.safe_balance_history(store_id);
CREATE INDEX IF NOT EXISTS idx_safe_balance_date ON public.safe_balance_history(date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_safe_balance_history_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_safe_balance_history_updated_at ON public.safe_balance_history;
CREATE TRIGGER trigger_safe_balance_history_updated_at
  BEFORE UPDATE ON public.safe_balance_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_safe_balance_history_updated_at();

-- Enable RLS
ALTER TABLE public.safe_balance_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow view safe balance history" ON public.safe_balance_history;
DROP POLICY IF EXISTS "Allow insert safe balance history" ON public.safe_balance_history;
DROP POLICY IF EXISTS "Allow update safe balance history" ON public.safe_balance_history;

-- RLS Policies: Allow all operations for anon and authenticated users
CREATE POLICY "Allow view safe balance history"
  ON public.safe_balance_history
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert safe balance history"
  ON public.safe_balance_history
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update safe balance history"
  ON public.safe_balance_history
  FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Function to get previous day's closing balance
CREATE OR REPLACE FUNCTION public.get_previous_safe_balance(
  p_store_id uuid,
  p_date date
)
RETURNS decimal(10, 2)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_previous_balance decimal(10, 2);
BEGIN
  SELECT closing_balance INTO v_previous_balance
  FROM public.safe_balance_history
  WHERE store_id = p_store_id
    AND date < p_date
  ORDER BY date DESC
  LIMIT 1;

  RETURN COALESCE(v_previous_balance, 0);
END;
$$;

-- Function to calculate safe balance for a specific date
CREATE OR REPLACE FUNCTION public.get_safe_balance_for_date(
  p_store_id uuid,
  p_date date
)
RETURNS TABLE (
  opening_balance decimal(10, 2),
  total_deposits decimal(10, 2),
  total_withdrawals decimal(10, 2),
  closing_balance decimal(10, 2)
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_opening_balance decimal(10, 2);
  v_total_deposits decimal(10, 2);
  v_total_withdrawals decimal(10, 2);
  v_closing_balance decimal(10, 2);
BEGIN
  v_opening_balance := public.get_previous_safe_balance(p_store_id, p_date);

  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposits
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_out'
    AND category = 'Safe Deposit'
    AND status = 'approved';

  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_out'
    AND category = 'Safe Withdrawal'
    AND status = 'approved';

  v_closing_balance := v_opening_balance + v_total_deposits - v_total_withdrawals;

  RETURN QUERY SELECT v_opening_balance, v_total_deposits, v_total_withdrawals, v_closing_balance;
END;
$$;
`;

async function applyMigration() {
  console.log('Applying safe balance migration...');

  const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL }).single();

  if (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }

  console.log('Migration applied successfully!');
}

applyMigration();
