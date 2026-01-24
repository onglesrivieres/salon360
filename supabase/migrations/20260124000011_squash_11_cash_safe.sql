/*
  # Squashed Migration: Cash & Safe Balance System

  ## Overview
  This migration consolidates cash and safe balance migrations for
  tracking cash transactions, safe balance history, and change proposals.

  ## Tables Created
  - cash_transactions: Cash in/out/payout/hq_deposit transactions
  - safe_balance_history: Daily safe balance snapshots
  - cash_transaction_change_proposals: Change requests for approved transactions
  - cash_transaction_edit_history: Audit trail for edits

  ## Functions Created
  - get_safe_balance_for_date: Calculate safe balance for a date
  - save_safe_balance_snapshot: Save daily balance snapshot
  - create_cash_transaction_with_validation: Create transaction with store access check
  - Change proposal functions: create, approve, reject
*/

-- ============================================================================
-- TABLE: cash_transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('cash_in', 'cash_out', 'cash_payout', 'hq_deposit')),
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
  last_edited_by_id uuid REFERENCES public.employees(id),
  last_edited_at timestamptz,
  bill_100 integer NOT NULL DEFAULT 0,
  bill_50 integer NOT NULL DEFAULT 0,
  bill_20 integer NOT NULL DEFAULT 0,
  bill_10 integer NOT NULL DEFAULT 0,
  bill_5 integer NOT NULL DEFAULT 0,
  bill_2 integer NOT NULL DEFAULT 0,
  bill_1 integer NOT NULL DEFAULT 0,
  coin_25 integer NOT NULL DEFAULT 0,
  coin_10 integer NOT NULL DEFAULT 0,
  coin_5 integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_store_id ON public.cash_transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON public.cash_transactions(date);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_status ON public.cash_transactions(status);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON public.cash_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_created_by ON public.cash_transactions(created_by_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_approved_by ON public.cash_transactions(manager_approved_by_id);

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to cash_transactions" ON public.cash_transactions;
CREATE POLICY "Allow all access to cash_transactions"
  ON public.cash_transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: safe_balance_history
-- ============================================================================
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

CREATE INDEX IF NOT EXISTS idx_safe_balance_store_date ON public.safe_balance_history(store_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_safe_balance_store_id ON public.safe_balance_history(store_id);
CREATE INDEX IF NOT EXISTS idx_safe_balance_date ON public.safe_balance_history(date);

ALTER TABLE public.safe_balance_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to safe_balance_history" ON public.safe_balance_history;
CREATE POLICY "Allow all access to safe_balance_history"
  ON public.safe_balance_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: cash_transaction_change_proposals
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cash_transaction_change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_transaction_id uuid NOT NULL REFERENCES public.cash_transactions(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  current_amount decimal(10, 2) NOT NULL,
  current_category text,
  current_description text NOT NULL,
  "current_date" date NOT NULL,
  proposed_amount decimal(10, 2),
  proposed_category text,
  proposed_description text,
  proposed_date date,
  is_deletion_request boolean NOT NULL DEFAULT false,
  reason_comment text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewed_by_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_comment text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT at_least_one_change CHECK (
    is_deletion_request = true OR proposed_amount IS NOT NULL OR proposed_category IS NOT NULL
    OR proposed_description IS NOT NULL OR proposed_date IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_ctcp_cash_transaction ON public.cash_transaction_change_proposals(cash_transaction_id);
CREATE INDEX IF NOT EXISTS idx_ctcp_store ON public.cash_transaction_change_proposals(store_id);
CREATE INDEX IF NOT EXISTS idx_ctcp_status ON public.cash_transaction_change_proposals(status);
CREATE INDEX IF NOT EXISTS idx_ctcp_created_by ON public.cash_transaction_change_proposals(created_by_employee_id);

ALTER TABLE public.cash_transaction_change_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to cash_transaction_change_proposals" ON public.cash_transaction_change_proposals;
CREATE POLICY "Allow all access to cash_transaction_change_proposals"
  ON public.cash_transaction_change_proposals FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- TABLE: cash_transaction_edit_history
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cash_transaction_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.cash_transactions(id) ON DELETE CASCADE,
  edited_by_id uuid NOT NULL REFERENCES public.employees(id),
  edited_at timestamptz NOT NULL DEFAULT now(),
  old_amount numeric(10,2),
  new_amount numeric(10,2),
  old_description text,
  new_description text,
  old_category text,
  new_category text,
  edit_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_transaction_edit_history_transaction_id ON public.cash_transaction_edit_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cash_transaction_edit_history_edited_at ON public.cash_transaction_edit_history(edited_at DESC);

ALTER TABLE public.cash_transaction_edit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to cash_transaction_edit_history" ON public.cash_transaction_edit_history;
CREATE POLICY "Allow all access to cash_transaction_edit_history"
  ON public.cash_transaction_edit_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- FUNCTION: update_cash_transactions_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_cash_transactions_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_cash_transactions_updated_at ON public.cash_transactions;
CREATE TRIGGER trigger_cash_transactions_updated_at
  BEFORE UPDATE ON public.cash_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_cash_transactions_updated_at();

-- ============================================================================
-- FUNCTION: update_safe_balance_history_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_safe_balance_history_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_safe_balance_history_updated_at ON public.safe_balance_history;
CREATE TRIGGER trigger_safe_balance_history_updated_at
  BEFORE UPDATE ON public.safe_balance_history
  FOR EACH ROW EXECUTE FUNCTION public.update_safe_balance_history_updated_at();

-- ============================================================================
-- FUNCTION: update_cash_transaction_change_proposals_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_cash_transaction_change_proposals_updated_at()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_cash_transaction_change_proposals_updated_at ON public.cash_transaction_change_proposals;
CREATE TRIGGER update_cash_transaction_change_proposals_updated_at
  BEFORE UPDATE ON public.cash_transaction_change_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_cash_transaction_change_proposals_updated_at();

-- ============================================================================
-- FUNCTION: log_cash_transaction_edit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_cash_transaction_edit()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.amount IS DISTINCT FROM NEW.amount OR OLD.description IS DISTINCT FROM NEW.description OR OLD.category IS DISTINCT FROM NEW.category THEN
      INSERT INTO public.cash_transaction_edit_history (
        transaction_id, edited_by_id, edited_at, old_amount, new_amount, old_description, new_description, old_category, new_category
      ) VALUES (
        NEW.id, NEW.last_edited_by_id, NEW.last_edited_at, OLD.amount, NEW.amount, OLD.description, NEW.description, OLD.category, NEW.category
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_cash_transaction_edits ON public.cash_transactions;
CREATE TRIGGER log_cash_transaction_edits
  AFTER UPDATE ON public.cash_transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_cash_transaction_edit();

-- ============================================================================
-- FUNCTION: get_previous_safe_balance
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_previous_safe_balance(p_store_id uuid, p_date date)
RETURNS decimal(10, 2)
SECURITY DEFINER SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE v_previous_balance decimal(10, 2);
BEGIN
  SELECT closing_balance INTO v_previous_balance FROM public.safe_balance_history
  WHERE store_id = p_store_id AND date < p_date ORDER BY date DESC LIMIT 1;
  RETURN COALESCE(v_previous_balance, 0);
END;
$$;

-- ============================================================================
-- FUNCTION: get_safe_balance_for_date
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_safe_balance_for_date(p_store_id uuid, p_date date)
RETURNS TABLE (opening_balance decimal(10, 2), total_deposits decimal(10, 2), total_withdrawals decimal(10, 2), closing_balance decimal(10, 2))
SECURITY DEFINER SET search_path = public, pg_temp
LANGUAGE plpgsql AS $$
DECLARE
  v_opening_balance decimal(10, 2);
  v_total_deposits decimal(10, 2);
  v_total_withdrawals decimal(10, 2);
  v_closing_balance decimal(10, 2);
BEGIN
  v_opening_balance := public.get_previous_safe_balance(p_store_id, p_date);

  -- Deposits: Safe Deposit (cash_out) + HQ deposits
  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposits FROM public.cash_transactions
  WHERE store_id = p_store_id AND date = p_date AND status = 'approved'
    AND ((transaction_type = 'cash_out' AND category = 'Safe Deposit') OR transaction_type = 'hq_deposit');

  -- Withdrawals: Payroll, Tip Payout, Headquarter Deposit, Other
  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals FROM public.cash_transactions
  WHERE store_id = p_store_id AND date = p_date AND status = 'approved'
    AND transaction_type = 'cash_payout' AND category IN ('Payroll', 'Tip Payout', 'Headquarter Deposit', 'Other');

  v_closing_balance := v_opening_balance + v_total_deposits - v_total_withdrawals;
  RETURN QUERY SELECT v_opening_balance, v_total_deposits, v_total_withdrawals, v_closing_balance;
END;
$$;

-- ============================================================================
-- FUNCTION: save_safe_balance_snapshot
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_safe_balance_snapshot(p_store_id uuid, p_date date, p_employee_id uuid)
RETURNS TABLE (id uuid, store_id uuid, date date, opening_balance decimal(10, 2), closing_balance decimal(10, 2), total_deposits decimal(10, 2), total_withdrawals decimal(10, 2), created_at timestamptz, updated_at timestamptz)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_balance_data RECORD;
  v_snapshot_id uuid;
BEGIN
  SELECT * INTO v_balance_data FROM public.get_safe_balance_for_date(p_store_id, p_date);

  INSERT INTO public.safe_balance_history (store_id, date, opening_balance, closing_balance, total_deposits, total_withdrawals, created_by_id, updated_by_id)
  VALUES (p_store_id, p_date, v_balance_data.opening_balance, v_balance_data.closing_balance, v_balance_data.total_deposits, v_balance_data.total_withdrawals, p_employee_id, p_employee_id)
  ON CONFLICT (store_id, date) DO UPDATE SET
    opening_balance = EXCLUDED.opening_balance, closing_balance = EXCLUDED.closing_balance,
    total_deposits = EXCLUDED.total_deposits, total_withdrawals = EXCLUDED.total_withdrawals,
    updated_by_id = EXCLUDED.updated_by_id, updated_at = now()
  RETURNING safe_balance_history.id INTO v_snapshot_id;

  RETURN QUERY SELECT sbh.id, sbh.store_id, sbh.date, sbh.opening_balance, sbh.closing_balance, sbh.total_deposits, sbh.total_withdrawals, sbh.created_at, sbh.updated_at
  FROM public.safe_balance_history sbh WHERE sbh.id = v_snapshot_id;
END;
$$;

-- ============================================================================
-- FUNCTION: get_safe_balance_history
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_safe_balance_history(p_store_id uuid, p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS TABLE (id uuid, date date, opening_balance decimal(10, 2), closing_balance decimal(10, 2), total_deposits decimal(10, 2), total_withdrawals decimal(10, 2), balance_change decimal(10, 2), created_by_name text, updated_by_name text, created_at timestamptz, updated_at timestamptz)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT sbh.id, sbh.date, sbh.opening_balance, sbh.closing_balance, sbh.total_deposits, sbh.total_withdrawals,
         (sbh.closing_balance - sbh.opening_balance), creator.name, updater.name, sbh.created_at, sbh.updated_at
  FROM public.safe_balance_history sbh
  LEFT JOIN public.employees creator ON sbh.created_by_id = creator.id
  LEFT JOIN public.employees updater ON sbh.updated_by_id = updater.id
  WHERE sbh.store_id = p_store_id
    AND (p_start_date IS NULL OR sbh.date >= p_start_date)
    AND (p_end_date IS NULL OR sbh.date <= p_end_date)
  ORDER BY sbh.date DESC LIMIT p_limit;
END;
$$;

-- ============================================================================
-- FUNCTION: backfill_safe_balance_snapshots
-- ============================================================================
CREATE OR REPLACE FUNCTION public.backfill_safe_balance_snapshots(p_store_id uuid, p_start_date date, p_end_date date, p_employee_id uuid)
RETURNS TABLE (date date, success boolean, message text)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE v_current_date date;
BEGIN
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    BEGIN
      PERFORM public.save_safe_balance_snapshot(p_store_id, v_current_date, p_employee_id);
      RETURN QUERY SELECT v_current_date, true, 'Snapshot created successfully'::text;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_current_date, false, SQLERRM::text;
    END;
    v_current_date := v_current_date + 1;
  END LOOP;
END;
$$;

-- ============================================================================
-- FUNCTION: get_pending_cash_transaction_approvals
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_cash_transaction_approvals(p_store_id uuid)
RETURNS TABLE (transaction_id uuid, transaction_type text, amount numeric, description text, category text, date date, created_by_name text, created_by_id uuid, created_by_role text, created_at timestamptz, requires_manager_approval boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT ct.id, ct.transaction_type, ct.amount, ct.description, ct.category, ct.date,
         COALESCE(e.display_name, e.legal_name, 'Unknown'),
         ct.created_by_id,
         CASE
           WHEN 'Admin' = ANY(e.role) OR 'Manager' = ANY(e.role) OR 'Owner' = ANY(e.role) THEN 'Admin'
           WHEN 'Supervisor' = ANY(e.role) THEN 'Supervisor'
           WHEN 'Receptionist' = ANY(e.role) THEN 'Receptionist'
           WHEN 'Cashier' = ANY(e.role) THEN 'Cashier'
           ELSE 'Technician'
         END,
         ct.created_at, ct.requires_manager_approval
  FROM public.cash_transactions ct
  LEFT JOIN public.employees e ON ct.created_by_id = e.id
  WHERE ct.store_id = p_store_id AND ct.status = 'pending_approval'
  ORDER BY ct.created_at DESC;
END;
$$;

-- ============================================================================
-- FUNCTION: create_cash_transaction_with_validation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_cash_transaction_with_validation(
  p_store_id uuid, p_date date, p_transaction_type text, p_amount numeric,
  p_description text, p_category text, p_created_by_id uuid,
  p_bill_100 integer DEFAULT 0, p_bill_50 integer DEFAULT 0, p_bill_20 integer DEFAULT 0,
  p_bill_10 integer DEFAULT 0, p_bill_5 integer DEFAULT 0, p_bill_2 integer DEFAULT 0,
  p_bill_1 integer DEFAULT 0, p_coin_25 integer DEFAULT 0, p_coin_10 integer DEFAULT 0, p_coin_5 integer DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_has_access boolean;
  v_transaction_id uuid;
BEGIN
  v_has_access := public.check_employee_store_access(p_created_by_id, p_store_id);
  IF NOT v_has_access THEN
    RETURN json_build_object('success', false, 'error', 'Access denied: You do not have permission to create transactions for this store', 'error_code', 'STORE_ACCESS_DENIED');
  END IF;

  INSERT INTO public.cash_transactions (
    store_id, date, transaction_type, amount, description, category, created_by_id, status, requires_manager_approval,
    bill_100, bill_50, bill_20, bill_10, bill_5, bill_2, bill_1, coin_25, coin_10, coin_5
  ) VALUES (
    p_store_id, p_date, p_transaction_type, p_amount, p_description, p_category, p_created_by_id, 'pending_approval', true,
    p_bill_100, p_bill_50, p_bill_20, p_bill_10, p_bill_5, p_bill_2, p_bill_1, p_coin_25, p_coin_10, p_coin_5
  ) RETURNING id INTO v_transaction_id;

  RETURN json_build_object('success', true, 'transaction_id', v_transaction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_cash_transaction_with_validation TO anon, authenticated;

-- ============================================================================
-- FUNCTION: has_pending_cash_transaction_change_proposal
-- ============================================================================
CREATE OR REPLACE FUNCTION public.has_pending_cash_transaction_change_proposal(p_cash_transaction_id uuid)
RETURNS boolean
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.cash_transaction_change_proposals WHERE cash_transaction_id = p_cash_transaction_id AND status = 'pending');
END;
$$;

-- ============================================================================
-- FUNCTION: create_cash_transaction_change_proposal
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_cash_transaction_change_proposal(
  p_cash_transaction_id uuid, p_proposed_amount decimal DEFAULT NULL, p_proposed_category text DEFAULT NULL,
  p_proposed_description text DEFAULT NULL, p_proposed_date date DEFAULT NULL,
  p_is_deletion_request boolean DEFAULT false, p_reason_comment text DEFAULT NULL, p_created_by_employee_id uuid DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_transaction RECORD;
  v_employee RECORD;
  v_proposal_id uuid;
BEGIN
  IF p_reason_comment IS NULL OR trim(p_reason_comment) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is required');
  END IF;

  IF NOT p_is_deletion_request AND p_proposed_amount IS NULL AND p_proposed_category IS NULL AND p_proposed_description IS NULL AND p_proposed_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least one change or deletion is required');
  END IF;

  SELECT * INTO v_employee FROM public.employees WHERE id = p_created_by_employee_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Employee not found'); END IF;
  IF NOT ('Manager' = ANY(v_employee.role) OR 'Admin' = ANY(v_employee.role) OR 'Owner' = ANY(v_employee.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Managers, Admins, and Owners can create change proposals');
  END IF;

  SELECT * INTO v_transaction FROM public.cash_transactions WHERE id = p_cash_transaction_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Transaction not found'); END IF;
  IF v_transaction.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only request changes to approved transactions');
  END IF;

  IF public.has_pending_cash_transaction_change_proposal(p_cash_transaction_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A pending change request already exists for this transaction');
  END IF;

  INSERT INTO public.cash_transaction_change_proposals (
    cash_transaction_id, store_id, current_amount, current_category, current_description, "current_date",
    proposed_amount, proposed_category, proposed_description, proposed_date, is_deletion_request, reason_comment, created_by_employee_id
  ) VALUES (
    p_cash_transaction_id, v_transaction.store_id, v_transaction.amount, v_transaction.category, v_transaction.description, v_transaction.date,
    p_proposed_amount, p_proposed_category, p_proposed_description, p_proposed_date, p_is_deletion_request, trim(p_reason_comment), p_created_by_employee_id
  ) RETURNING id INTO v_proposal_id;

  RETURN jsonb_build_object('success', true, 'proposal_id', v_proposal_id);
END;
$$;

-- ============================================================================
-- FUNCTION: get_pending_cash_transaction_change_proposals
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_cash_transaction_change_proposals(p_store_id uuid)
RETURNS TABLE (proposal_id uuid, cash_transaction_id uuid, transaction_type text, current_amount decimal, current_category text, current_description text, "current_date" date, proposed_amount decimal, proposed_category text, proposed_description text, proposed_date date, is_deletion_request boolean, reason_comment text, created_by_name text, created_by_id uuid, created_at timestamptz)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.cash_transaction_id, ct.transaction_type::text, p.current_amount, p.current_category, p.current_description, p."current_date",
         p.proposed_amount, p.proposed_category, p.proposed_description, p.proposed_date, p.is_deletion_request, p.reason_comment,
         COALESCE(e.display_name, e.legal_name, 'Unknown'), p.created_by_employee_id, p.created_at
  FROM public.cash_transaction_change_proposals p
  INNER JOIN public.cash_transactions ct ON ct.id = p.cash_transaction_id
  INNER JOIN public.employees e ON e.id = p.created_by_employee_id
  WHERE p.store_id = p_store_id AND p.status = 'pending'
  ORDER BY p.created_at DESC;
END;
$$;

-- ============================================================================
-- FUNCTION: get_pending_cash_transaction_change_proposals_count
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_cash_transaction_change_proposals_count(p_store_id uuid)
RETURNS integer
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN (SELECT COUNT(*)::integer FROM public.cash_transaction_change_proposals WHERE store_id = p_store_id AND status = 'pending');
END;
$$;

-- ============================================================================
-- FUNCTION: approve_cash_transaction_change_proposal
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_cash_transaction_change_proposal(p_proposal_id uuid, p_reviewer_employee_id uuid, p_review_comment text DEFAULT NULL)
RETURNS jsonb
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_proposal RECORD;
  v_reviewer RECORD;
BEGIN
  SELECT * INTO v_reviewer FROM public.employees WHERE id = p_reviewer_employee_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found'); END IF;
  IF NOT ('Owner' = ANY(v_reviewer.role) OR 'Admin' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Owners or Admins can approve change proposals');
  END IF;

  SELECT * INTO v_proposal FROM public.cash_transaction_change_proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Proposal not found'); END IF;
  IF v_proposal.status != 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'Proposal has already been reviewed'); END IF;

  IF v_proposal.is_deletion_request THEN
    DELETE FROM public.cash_transactions WHERE id = v_proposal.cash_transaction_id;
  ELSE
    UPDATE public.cash_transactions SET
      amount = COALESCE(v_proposal.proposed_amount, amount),
      category = COALESCE(v_proposal.proposed_category, category),
      description = COALESCE(v_proposal.proposed_description, description),
      date = COALESCE(v_proposal.proposed_date, date),
      last_edited_by_id = p_reviewer_employee_id, last_edited_at = now(), updated_at = now()
    WHERE id = v_proposal.cash_transaction_id;
  END IF;

  UPDATE public.cash_transaction_change_proposals SET
    status = 'approved', reviewed_by_employee_id = p_reviewer_employee_id, reviewed_at = now(),
    review_comment = NULLIF(trim(COALESCE(p_review_comment, '')), '')
  WHERE id = p_proposal_id;

  RETURN jsonb_build_object('success', true, 'message', CASE WHEN v_proposal.is_deletion_request THEN 'Transaction deleted successfully' ELSE 'Transaction updated successfully' END);
END;
$$;

-- ============================================================================
-- FUNCTION: reject_cash_transaction_change_proposal
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reject_cash_transaction_change_proposal(p_proposal_id uuid, p_reviewer_employee_id uuid, p_review_comment text)
RETURNS jsonb
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_proposal RECORD;
  v_reviewer RECORD;
BEGIN
  IF p_review_comment IS NULL OR trim(p_review_comment) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rejection reason is required');
  END IF;

  SELECT * INTO v_reviewer FROM public.employees WHERE id = p_reviewer_employee_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found'); END IF;
  IF NOT ('Owner' = ANY(v_reviewer.role) OR 'Admin' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Owners or Admins can reject change proposals');
  END IF;

  SELECT * INTO v_proposal FROM public.cash_transaction_change_proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Proposal not found'); END IF;
  IF v_proposal.status != 'pending' THEN RETURN jsonb_build_object('success', false, 'error', 'Proposal has already been reviewed'); END IF;

  UPDATE public.cash_transaction_change_proposals SET
    status = 'rejected', reviewed_by_employee_id = p_reviewer_employee_id, reviewed_at = now(), review_comment = trim(p_review_comment)
  WHERE id = p_proposal_id;

  RETURN jsonb_build_object('success', true, 'message', 'Change request rejected');
END;
$$;

-- ============================================================================
-- FUNCTION: create_headquarter_deposit_transfer
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_headquarter_deposit_transfer()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_hq_store_id uuid;
  v_source_store_name text;
BEGIN
  IF NEW.transaction_type != 'cash_payout' OR NEW.category != 'Headquarter Deposit' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_hq_store_id FROM public.stores WHERE is_headquarters = true LIMIT 1;
  IF v_hq_store_id IS NULL OR NEW.store_id = v_hq_store_id THEN RETURN NEW; END IF;

  SELECT name INTO v_source_store_name FROM public.stores WHERE id = NEW.store_id;

  INSERT INTO public.cash_transactions (
    store_id, date, transaction_type, amount, description, category, created_by_id,
    status, requires_manager_approval, manager_approved, manager_approved_by_id, manager_approved_at
  ) VALUES (
    v_hq_store_id, NEW.date, 'hq_deposit', NEW.amount, 'HQ Deposit from ' || COALESCE(v_source_store_name, 'Unknown Store'),
    'Safe Deposit', NEW.created_by_id, 'approved', false, true, NEW.created_by_id, now()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_headquarter_deposit_transfer ON public.cash_transactions;
CREATE TRIGGER trigger_headquarter_deposit_transfer
  AFTER INSERT ON public.cash_transactions
  FOR EACH ROW EXECUTE FUNCTION public.create_headquarter_deposit_transfer();

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
