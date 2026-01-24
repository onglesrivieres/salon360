/*
  # Create Cash Transactions Table with Approval Workflow

  1. New Tables
    - `cash_transactions`
      - `id` (uuid, primary key)
      - `store_id` (uuid, foreign key to stores)
      - `date` (date) - Transaction date
      - `transaction_type` (text) - 'cash_in' or 'cash_out'
      - `amount` (decimal) - Transaction amount
      - `description` (text) - Transaction description
      - `category` (text) - Optional category
      - `created_by_id` (uuid, foreign key to employees)
      - `status` (text) - 'pending_approval', 'approved', 'rejected'
      - `requires_manager_approval` (boolean)
      - `manager_approved` (boolean)
      - `manager_approved_by_id` (uuid, foreign key to employees)
      - `manager_approved_at` (timestamptz)
      - `rejection_reason` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `cash_transactions` table
    - Add policies for anon and authenticated users (PIN authentication system)
    - Application-level security through role checks

  3. Indexes
    - Index on `store_id` for query performance
    - Index on `date` for date-based queries
    - Index on `status` for filtering pending approvals
    - Index on `transaction_type` for filtering cash in/out
    - Index on `created_by_id` for creator lookups
*/

-- Create cash_transactions table
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('cash_in', 'cash_out')),
  amount decimal(10, 2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  category text,
  created_by_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  requires_manager_approval boolean NOT NULL DEFAULT true,
  manager_approved boolean NOT NULL DEFAULT false,
  manager_approved_by_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  manager_approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cash_transactions_store_id ON public.cash_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON public.cash_transactions(date);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_status ON public.cash_transactions(status);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON public.cash_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_created_by ON public.cash_transactions(created_by_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_approved_by ON public.cash_transactions(manager_approved_by_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_cash_transactions_updated_at()
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
CREATE TRIGGER trigger_cash_transactions_updated_at
  BEFORE UPDATE ON public.cash_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cash_transactions_updated_at();

-- Enable RLS
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for anon and authenticated users
-- Security is handled at application level through PIN authentication
CREATE POLICY "Allow view cash transactions"
  ON public.cash_transactions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert cash transactions"
  ON public.cash_transactions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update cash transactions"
  ON public.cash_transactions
  FOR UPDATE
  TO anon, authenticated
  USING (true);
