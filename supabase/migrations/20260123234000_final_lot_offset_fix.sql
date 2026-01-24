/*
  # Final Lot Number Offset Fix

  ## Problem
  Migration 20260123220725 overwrites the lot creation function without the offset
  parameter, causing duplicate lot numbers when approving transactions with
  multiple items.

  ## Fix
  This migration has timestamp 234000 (after 233154) to ensure it runs LAST
  and the offset logic is preserved.
*/

CREATE OR REPLACE FUNCTION public.create_lots_from_approved_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction_item record;
  v_lot_id uuid;
  v_lot_number text;
  v_supplier_id uuid;
  v_invoice_ref text;
  v_item_index int := 0;
BEGIN
  IF NEW.transaction_type = 'in'
     AND NEW.status = 'approved'
     AND (OLD.status IS NULL OR OLD.status != 'approved')
     AND NEW.manager_approved = true
  THEN
    v_supplier_id := NEW.supplier_id;
    v_invoice_ref := NEW.invoice_reference;

    FOR v_transaction_item IN
      SELECT
        ti.id,
        ti.item_id,
        ti.quantity,
        ti.unit_cost,
        ti.purchase_unit_id,
        ti.purchase_quantity,
        ti.purchase_unit_multiplier,
        ti.notes,
        ii.store_id
      FROM public.inventory_transaction_items ti
      JOIN public.inventory_items ii ON ii.id = ti.item_id
      WHERE ti.transaction_id = NEW.id
      ORDER BY ti.id  -- Consistent ordering
    LOOP
      -- Generate lot number WITH OFFSET for unique sequential numbers
      v_lot_number := public.generate_lot_number(
        v_transaction_item.store_id,
        NULL,
        v_item_index  -- Each item gets different offset (0, 1, 2...)
      );
      v_item_index := v_item_index + 1;

      INSERT INTO public.inventory_purchase_lots (
        lot_number,
        store_id,
        item_id,
        supplier_id,
        quantity_received,
        quantity_remaining,
        unit_cost,
        purchase_date,
        invoice_reference,
        notes,
        status,
        created_by_id,
        created_at,
        updated_at
      ) VALUES (
        v_lot_number,
        v_transaction_item.store_id,
        v_transaction_item.item_id,
        v_supplier_id,
        v_transaction_item.quantity,
        v_transaction_item.quantity,
        v_transaction_item.unit_cost,
        NEW.created_at,
        v_invoice_ref,
        CASE
          WHEN v_transaction_item.purchase_quantity IS NOT NULL THEN
            'Purchased: ' || v_transaction_item.purchase_quantity || ' units at multiplier ' || v_transaction_item.purchase_unit_multiplier || '. ' || COALESCE(v_transaction_item.notes, '')
          ELSE
            v_transaction_item.notes
        END,
        'active',
        NEW.requested_by_id,
        now(),
        now()
      )
      RETURNING id INTO v_lot_id;

      UPDATE public.inventory_transaction_items
      SET lot_id = v_lot_id
      WHERE id = v_transaction_item.id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
