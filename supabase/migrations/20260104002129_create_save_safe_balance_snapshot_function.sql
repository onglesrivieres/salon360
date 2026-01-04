/*
  # Create Safe Balance Snapshot Save Function

  1. New Functions
    - `save_safe_balance_snapshot` - Saves or updates a daily balance snapshot
      - Accepts store_id, date, and employee_id
      - Calculates balances using existing get_safe_balance_for_date function
      - Inserts or updates the snapshot in safe_balance_history
      - Returns the saved snapshot data

  2. Purpose
    - Creates permanent audit trail of daily safe balances
    - Ensures next day's opening balance equals previous day's closing balance
    - Supports both automatic (End of Day) and manual snapshot creation

  3. Usage
    - Call at End of Day to save closing balance
    - Call when viewing Safe Balance page to ensure current data
    - Can be called multiple times for same date (updates existing record)
*/

-- Function to save or update a safe balance snapshot
CREATE OR REPLACE FUNCTION public.save_safe_balance_snapshot(
  p_store_id uuid,
  p_date date,
  p_employee_id uuid
)
RETURNS TABLE (
  id uuid,
  store_id uuid,
  date date,
  opening_balance decimal(10, 2),
  closing_balance decimal(10, 2),
  total_deposits decimal(10, 2),
  total_withdrawals decimal(10, 2),
  created_at timestamptz,
  updated_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance_data RECORD;
  v_snapshot_id uuid;
BEGIN
  -- Calculate the balance for the specified date
  SELECT * INTO v_balance_data
  FROM public.get_safe_balance_for_date(p_store_id, p_date);

  -- Insert or update the snapshot
  INSERT INTO public.safe_balance_history (
    store_id,
    date,
    opening_balance,
    closing_balance,
    total_deposits,
    total_withdrawals,
    created_by_id,
    updated_by_id
  )
  VALUES (
    p_store_id,
    p_date,
    v_balance_data.opening_balance,
    v_balance_data.closing_balance,
    v_balance_data.total_deposits,
    v_balance_data.total_withdrawals,
    p_employee_id,
    p_employee_id
  )
  ON CONFLICT (store_id, date)
  DO UPDATE SET
    opening_balance = EXCLUDED.opening_balance,
    closing_balance = EXCLUDED.closing_balance,
    total_deposits = EXCLUDED.total_deposits,
    total_withdrawals = EXCLUDED.total_withdrawals,
    updated_by_id = EXCLUDED.updated_by_id,
    updated_at = now()
  RETURNING safe_balance_history.id INTO v_snapshot_id;

  -- Return the saved snapshot
  RETURN QUERY
  SELECT
    sbh.id,
    sbh.store_id,
    sbh.date,
    sbh.opening_balance,
    sbh.closing_balance,
    sbh.total_deposits,
    sbh.total_withdrawals,
    sbh.created_at,
    sbh.updated_at
  FROM public.safe_balance_history sbh
  WHERE sbh.id = v_snapshot_id;
END;
$$;

-- Function to get balance snapshot history for a store
CREATE OR REPLACE FUNCTION public.get_safe_balance_history(
  p_store_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_limit int DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  date date,
  opening_balance decimal(10, 2),
  closing_balance decimal(10, 2),
  total_deposits decimal(10, 2),
  total_withdrawals decimal(10, 2),
  balance_change decimal(10, 2),
  created_by_name text,
  updated_by_name text,
  created_at timestamptz,
  updated_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sbh.id,
    sbh.date,
    sbh.opening_balance,
    sbh.closing_balance,
    sbh.total_deposits,
    sbh.total_withdrawals,
    (sbh.closing_balance - sbh.opening_balance) as balance_change,
    creator.name as created_by_name,
    updater.name as updated_by_name,
    sbh.created_at,
    sbh.updated_at
  FROM public.safe_balance_history sbh
  LEFT JOIN public.employees creator ON sbh.created_by_id = creator.id
  LEFT JOIN public.employees updater ON sbh.updated_by_id = updater.id
  WHERE sbh.store_id = p_store_id
    AND (p_start_date IS NULL OR sbh.date >= p_start_date)
    AND (p_end_date IS NULL OR sbh.date <= p_end_date)
  ORDER BY sbh.date DESC
  LIMIT p_limit;
END;
$$;

-- Function to backfill historical snapshots
CREATE OR REPLACE FUNCTION public.backfill_safe_balance_snapshots(
  p_store_id uuid,
  p_start_date date,
  p_end_date date,
  p_employee_id uuid
)
RETURNS TABLE (
  date date,
  success boolean,
  message text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_date date;
  v_snapshot_result RECORD;
BEGIN
  v_current_date := p_start_date;

  WHILE v_current_date <= p_end_date LOOP
    BEGIN
      -- Save snapshot for the current date
      SELECT * INTO v_snapshot_result
      FROM public.save_safe_balance_snapshot(p_store_id, v_current_date, p_employee_id)
      LIMIT 1;

      RETURN QUERY SELECT v_current_date, true, 'Snapshot created successfully'::text;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_current_date, false, SQLERRM::text;
    END;

    v_current_date := v_current_date + 1;
  END LOOP;
END;
$$;
