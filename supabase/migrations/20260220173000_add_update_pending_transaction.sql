-- ============================================================================
-- Migration: Add update_pending_transaction RPC
-- Description: Allows managers to edit pending inventory transactions (IN/OUT)
--              before approving. Identical to update_draft_transaction but
--              operates on status = 'pending' instead of 'draft'.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_pending_transaction(
  p_transaction_id uuid,
  p_transaction_type text DEFAULT NULL,
  p_recipient_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_invoice_reference text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_destination_store_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
BEGIN
  SELECT status INTO v_current_status
  FROM public.inventory_transactions
  WHERE id = p_transaction_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_current_status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending transactions can be edited. Current status: %', v_current_status;
  END IF;

  UPDATE public.inventory_transactions
  SET
    transaction_type = COALESCE(p_transaction_type, transaction_type),
    recipient_id = p_recipient_id,
    supplier_id = p_supplier_id,
    invoice_reference = p_invoice_reference,
    notes = COALESCE(p_notes, notes),
    destination_store_id = p_destination_store_id,
    updated_at = NOW()
  WHERE id = p_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_pending_transaction(uuid, text, uuid, uuid, text, text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
