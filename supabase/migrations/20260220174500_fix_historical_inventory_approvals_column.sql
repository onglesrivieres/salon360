/*
  # Fix get_historical_inventory_approvals Column References

  1. The LEFT JOIN on inventory_transaction_items referenced a non-existent column
     `inventory_transaction_id`. The actual column is `transaction_id`.

  2. `SUM(iti.total_cost)` referenced a non-existent column. The actual columns
     are `unit_cost` and `quantity`, so the total is computed as `unit_cost * quantity`.

  PostgreSQL error 42703 (undefined column) caused 400 errors on the
  Pending Approvals → Inventory tab historical section.
*/

CREATE OR REPLACE FUNCTION public.get_historical_inventory_approvals(p_store_id uuid)
RETURNS TABLE (
  transaction_id uuid,
  transaction_number text,
  transaction_type text,
  requested_by_name text,
  item_count bigint,
  total_value numeric,
  destination_store_name text,
  source_store_name text,
  status text,
  manager_approved_by_name text,
  manager_approved_at timestamptz,
  rejection_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    it.id AS transaction_id,
    it.transaction_number,
    it.transaction_type,
    COALESCE(requester.display_name, '') AS requested_by_name,
    COUNT(iti.id) AS item_count,
    COALESCE(SUM(iti.unit_cost * iti.quantity), 0) AS total_value,
    dest_store.name AS destination_store_name,
    src_store.name AS source_store_name,
    it.status,
    COALESCE(approver.display_name, '') AS manager_approved_by_name,
    it.manager_approved_at,
    COALESCE(it.rejection_reason, '') AS rejection_reason
  FROM public.inventory_transactions it
  LEFT JOIN public.employees requester ON requester.id = it.requested_by_id
  LEFT JOIN public.employees approver ON approver.id = it.manager_approved_by_id
  LEFT JOIN public.stores dest_store ON dest_store.id = it.destination_store_id
  LEFT JOIN public.stores src_store ON src_store.id = it.store_id
  LEFT JOIN public.inventory_transaction_items iti ON iti.transaction_id = it.id
  WHERE
    it.status IN ('approved', 'rejected')
    AND (it.store_id = p_store_id OR it.destination_store_id = p_store_id)
  GROUP BY
    it.id,
    it.transaction_number,
    it.transaction_type,
    requester.display_name,
    dest_store.name,
    src_store.name,
    it.status,
    approver.display_name,
    it.manager_approved_at,
    it.rejection_reason
  ORDER BY it.manager_approved_at DESC NULLS LAST, it.updated_at DESC
  LIMIT 50;
END;
$$;

NOTIFY pgrst, 'reload schema';
