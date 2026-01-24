-- ============================================================================
-- CASH TRANSACTION CHANGE PROPOSALS MIGRATION
-- ============================================================================
-- This SQL creates the cash_transaction_change_proposals table to enable
-- managers to request changes to Safe Balance transactions when they make
-- input mistakes. Owner/Admin can review and approve/reject these requests.
-- ============================================================================

-- Create the cash_transaction_change_proposals table
CREATE TABLE IF NOT EXISTS public.cash_transaction_change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_transaction_id uuid NOT NULL REFERENCES public.cash_transactions(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,

  -- Current values (snapshot at proposal time)
  current_amount decimal(10, 2) NOT NULL,
  current_category text,
  current_description text NOT NULL,
  "current_date" date NOT NULL,

  -- Proposed values (NULL means no change to that field)
  proposed_amount decimal(10, 2),
  proposed_category text,
  proposed_description text,
  proposed_date date,

  -- Deletion flag
  is_deletion_request boolean NOT NULL DEFAULT false,

  -- Proposal metadata
  reason_comment text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Creator (Manager)
  created_by_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,

  -- Reviewer (Owner/Admin)
  reviewed_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_comment text,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Constraint: At least one change or deletion
  CONSTRAINT at_least_one_change CHECK (
    is_deletion_request = true OR
    proposed_amount IS NOT NULL OR
    proposed_category IS NOT NULL OR
    proposed_description IS NOT NULL OR
    proposed_date IS NOT NULL
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ctcp_cash_transaction
  ON public.cash_transaction_change_proposals(cash_transaction_id);

CREATE INDEX IF NOT EXISTS idx_ctcp_store
  ON public.cash_transaction_change_proposals(store_id);

CREATE INDEX IF NOT EXISTS idx_ctcp_status
  ON public.cash_transaction_change_proposals(status);

CREATE INDEX IF NOT EXISTS idx_ctcp_created_by
  ON public.cash_transaction_change_proposals(created_by_employee_id);

-- Enable RLS
ALTER TABLE public.cash_transaction_change_proposals ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to view proposals (PIN auth enforced at app level)
CREATE POLICY "Allow authenticated to view proposals"
  ON public.cash_transaction_change_proposals
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Allow all authenticated users to create proposals (role validation in RPC)
CREATE POLICY "Allow authenticated to create proposals"
  ON public.cash_transaction_change_proposals
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Policy: Allow all authenticated users to update proposals (role validation in RPC)
CREATE POLICY "Allow authenticated to update proposals"
  ON public.cash_transaction_change_proposals
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_cash_transaction_change_proposals_updated_at()
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

DROP TRIGGER IF EXISTS update_cash_transaction_change_proposals_updated_at ON public.cash_transaction_change_proposals;

CREATE TRIGGER update_cash_transaction_change_proposals_updated_at
  BEFORE UPDATE ON public.cash_transaction_change_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cash_transaction_change_proposals_updated_at();