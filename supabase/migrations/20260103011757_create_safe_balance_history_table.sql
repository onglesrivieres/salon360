/*
  # Create Safe Balance Management System

  1. New Tables
    - `safe_balance_history`
      - `id` (uuid, primary key)
      - `store_id` (uuid, foreign key to stores)
      - `date` (date) - Balance snapshot date
      - `opening_balance` (decimal) - Opening balance for the day
      - `closing_balance` (decimal) - Closing balance for the day
      - `total_deposits` (decimal) - Total safe deposits for the day
      - `total_withdrawals` (decimal) - Total safe withdrawals for the day
      - `created_by_id` (uuid, foreign key to employees)
      - `updated_by_id` (uuid, foreign key to employees)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Functions
    - `get_safe_balance_for_date` - Calculate safe balance for a specific date
    - `get_previous_safe_balance` - Get closing balance from previous day

  3. Security
    - Enable RLS on `safe_balance_history` table
    - Add policies for anon and authenticated users (PIN authentication system)

  4. Indexes
    - Index on `store_id` and `date` for efficient queries
    - Unique constraint on `store_id` and `date` to prevent duplicate entries
*/

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
  CONSTRAINT unique_safe_balance_store_date UNIQUE (store_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_safe_balance_store_date ON public.safe_balance_history(store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_safe_balance_store_id ON public.safe_balance_history(store_id);
CREATE INDEX IF NOT EXISTS idx_safe_balance_date ON public.safe_balance_history(date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_safe_balance_history_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
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

-- RLS Policies
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
SET search_path = public
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

-- Function to calculate safe balance for a specific date (initial version with withdrawals)
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
SET search_path = public
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

  -- Withdrawals are no longer tracked, set to 0
  v_total_withdrawals := 0;

  -- Calculate closing balance (opening + deposits only)
  v_closing_balance := v_opening_balance + v_total_deposits;

  RETURN QUERY SELECT v_opening_balance, v_total_deposits, v_total_withdrawals, v_closing_balance;
END;
$$;