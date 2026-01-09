/*
  # Fix Ambiguous Column Reference in Atomic Transaction Function

  1. Problem
    - The `create_inventory_transaction_atomic()` function has an ambiguous column reference
    - Line 127 references `transaction_number` without table qualifier
    - This causes confusion between the table column and the function's output column
    - Error: "column reference 'transaction_number' is ambiguous"

  2. Solution
    - Add table qualifier `inventory_transactions.` to the `transaction_number` reference in WHERE clause
    - This matches the pattern already used for `store_id` on line 128
    - Ensures PostgreSQL knows we're referring to the table column, not the output column

  3. Changes
    - Update the WHERE clause to use `inventory_transactions.transaction_number`
*/

-- Recreate the atomic transaction function with fix (only if table exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transactions') THEN
    RAISE NOTICE 'Skipping atomic transaction function fix - inventory_transactions table does not exist';
    RETURN;
  END IF;

  -- Drop existing function first
  DROP FUNCTION IF EXISTS public.create_inventory_transaction_atomic(uuid, text, uuid, uuid, uuid, text, text, boolean, boolean);

  -- Recreate with fixed column reference
  EXECUTE $func$
    CREATE FUNCTION public.create_inventory_transaction_atomic(
      p_store_id uuid,
      p_transaction_type text,
      p_requested_by_id uuid,
      p_recipient_id uuid DEFAULT NULL,
      p_supplier_id uuid DEFAULT NULL,
      p_invoice_reference text DEFAULT NULL,
      p_notes text DEFAULT '',
      p_requires_manager_approval boolean DEFAULT true,
      p_requires_recipient_approval boolean DEFAULT false
    )
    RETURNS TABLE(
      id uuid,
      transaction_number text,
      store_id uuid,
      transaction_type text,
      requested_by_id uuid,
      recipient_id uuid,
      supplier_id uuid,
      invoice_reference text,
      notes text,
      status text,
      requires_manager_approval boolean,
      requires_recipient_approval boolean,
      manager_approved boolean,
      recipient_approved boolean,
      created_at timestamptz,
      updated_at timestamptz
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
      v_date_str text;
      v_prefix text;
      v_next_num integer;
      v_transaction_number text;
      v_lock_key bigint;
      v_new_transaction record;
    BEGIN
      IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id cannot be null';
      END IF;

      IF p_requested_by_id IS NULL THEN
        RAISE EXCEPTION 'requested_by_id cannot be null';
      END IF;

      IF p_transaction_type NOT IN ('in', 'out') THEN
        RAISE EXCEPTION 'transaction_type must be either in or out';
      END IF;

      v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

      v_prefix := CASE
        WHEN p_transaction_type = 'in' THEN 'IN'
        WHEN p_transaction_type = 'out' THEN 'OUT'
        ELSE 'TXN'
      END;

      v_lock_key := hashtext(p_store_id::text || '-' || v_prefix || '-' || v_date_str);

      PERFORM pg_advisory_xact_lock(v_lock_key);

      SELECT COALESCE(MAX(
        CAST(
          SUBSTRING(inventory_transactions.transaction_number FROM '\d+$') AS INTEGER
        )
      ), 0) + 1
      INTO v_next_num
      FROM public.inventory_transactions
      WHERE inventory_transactions.transaction_number LIKE v_prefix || '-' || v_date_str || '-%'
        AND inventory_transactions.store_id = p_store_id;

      v_transaction_number := v_prefix || '-' || v_date_str || '-' || LPAD(v_next_num::text, 4, '0');

      INSERT INTO public.inventory_transactions (
        store_id,
        transaction_type,
        transaction_number,
        requested_by_id,
        recipient_id,
        supplier_id,
        invoice_reference,
        notes,
        status,
        requires_manager_approval,
        requires_recipient_approval,
        manager_approved,
        recipient_approved,
        created_at,
        updated_at
      ) VALUES (
        p_store_id,
        p_transaction_type,
        v_transaction_number,
        p_requested_by_id,
        p_recipient_id,
        p_supplier_id,
        p_invoice_reference,
        p_notes,
        'pending',
        p_requires_manager_approval,
        p_requires_recipient_approval,
        false,
        false,
        NOW(),
        NOW()
      )
      RETURNING * INTO v_new_transaction;

      RETURN QUERY SELECT
        v_new_transaction.id,
        v_new_transaction.transaction_number,
        v_new_transaction.store_id,
        v_new_transaction.transaction_type,
        v_new_transaction.requested_by_id,
        v_new_transaction.recipient_id,
        v_new_transaction.supplier_id,
        v_new_transaction.invoice_reference,
        v_new_transaction.notes,
        v_new_transaction.status,
        v_new_transaction.requires_manager_approval,
        v_new_transaction.requires_recipient_approval,
        v_new_transaction.manager_approved,
        v_new_transaction.recipient_approved,
        v_new_transaction.created_at,
        v_new_transaction.updated_at;
    END;
    $body$
  $func$;

  RAISE NOTICE 'Atomic transaction function fixed successfully';
END $$;
