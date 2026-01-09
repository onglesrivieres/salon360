/*
  # Create Atomic Inventory Transaction Functions

  1. Problem
    - Race condition between transaction number generation and insert
    - Client-side retry logic is complex and unreliable
    - Two separate database calls create a window for duplicates
    - Advisory lock only protects number generation, not the insert

  2. Solution
    - Create single atomic function that generates number AND inserts transaction
    - Advisory lock protects entire operation from start to finish
    - Batch insert function for transaction items
    - Remove old separate number generation function

  3. New Functions
    - `create_inventory_transaction_atomic()` - Atomically create transaction with unique number
    - `insert_transaction_items_batch()` - Batch insert all transaction items

  4. Benefits
    - Eliminates race condition completely
    - Single round-trip to database
    - Simpler client code (no retry logic needed)
    - Better performance
    - Guaranteed consistency

  5. Changes
    - Replaces `generate_inventory_transaction_number()` function
    - Client calls single RPC instead of RPC + insert
    - Transaction and items created in separate atomic operations
*/

-- Drop old transaction number generation function
DROP FUNCTION IF EXISTS public.generate_inventory_transaction_number(text, uuid);

-- Create functions only if required tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_transactions') THEN
    RAISE NOTICE 'Skipping atomic transaction functions - inventory_transactions table does not exist';
    RETURN;
  END IF;

  -- Drop existing functions first
  DROP FUNCTION IF EXISTS public.create_inventory_transaction_atomic(uuid, text, uuid, uuid, uuid, text, text, boolean, boolean);
  DROP FUNCTION IF EXISTS public.insert_transaction_items_batch(uuid, jsonb);

  -- Create atomic transaction creation function
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
          SUBSTRING(transaction_number FROM '\d+$') AS INTEGER
        )
      ), 0) + 1
      INTO v_next_num
      FROM public.inventory_transactions
      WHERE transaction_number LIKE v_prefix || '-' || v_date_str || '-%'
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

  -- Create batch transaction items insert function
  EXECUTE $func$
    CREATE FUNCTION public.insert_transaction_items_batch(
      p_transaction_id uuid,
      p_items jsonb
    )
    RETURNS TABLE(
      success boolean,
      items_inserted integer,
      message text
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
      v_item jsonb;
      v_count integer := 0;
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.inventory_transactions WHERE id = p_transaction_id) THEN
        RETURN QUERY SELECT false, 0, 'Transaction not found'::text;
        RETURN;
      END IF;

      IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RETURN QUERY SELECT false, 0, 'No items provided'::text;
        RETURN;
      END IF;

      FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
      LOOP
        INSERT INTO public.inventory_transaction_items (
          transaction_id,
          item_id,
          master_item_id,
          quantity,
          unit_cost,
          purchase_unit_id,
          purchase_quantity,
          purchase_unit_price,
          purchase_unit_multiplier,
          notes,
          created_at
        ) VALUES (
          p_transaction_id,
          (v_item->>'item_id')::uuid,
          (v_item->>'master_item_id')::uuid,
          (v_item->>'quantity')::numeric,
          (v_item->>'unit_cost')::numeric,
          CASE WHEN v_item->>'purchase_unit_id' IS NOT NULL
            THEN (v_item->>'purchase_unit_id')::uuid
            ELSE NULL
          END,
          CASE WHEN v_item->>'purchase_quantity' IS NOT NULL
            THEN (v_item->>'purchase_quantity')::numeric
            ELSE NULL
          END,
          CASE WHEN v_item->>'purchase_unit_price' IS NOT NULL
            THEN (v_item->>'purchase_unit_price')::numeric
            ELSE NULL
          END,
          CASE WHEN v_item->>'purchase_unit_multiplier' IS NOT NULL
            THEN (v_item->>'purchase_unit_multiplier')::numeric
            ELSE NULL
          END,
          COALESCE(v_item->>'notes', ''),
          NOW()
        );

        v_count := v_count + 1;
      END LOOP;

      RETURN QUERY SELECT true, v_count, 'Items inserted successfully'::text;
    END;
    $body$
  $func$;

  RAISE NOTICE 'Atomic transaction functions created successfully';
END $$;
