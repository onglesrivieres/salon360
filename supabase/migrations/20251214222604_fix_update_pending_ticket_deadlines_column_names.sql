/*
  # Fix Column Name Mismatch in update_pending_ticket_deadlines

  ## Problem
  The `update_pending_ticket_deadlines()` function uses incorrect column names:
  - Uses `requires_approval_level` but column is actually `approval_required_level`
  
  This causes the function to silently fail when updating deadlines for pending tickets
  when the auto-approval minutes setting is changed.

  ## Changes
  1. Recreate `update_pending_ticket_deadlines()` with correct column name `approval_required_level`
  2. Backfill all pending tickets to recalculate their approval_deadline based on store settings

  ## Security
  - No RLS changes
  - Function maintains SECURITY DEFINER for admin operations
*/

-- Fix the update_pending_ticket_deadlines function with correct column name
CREATE OR REPLACE FUNCTION public.update_pending_ticket_deadlines(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_approval_minutes_standard integer;
  v_approval_minutes_manager integer;
  v_count_standard integer;
  v_count_manager integer;
  v_count_total integer;
BEGIN
  v_approval_minutes_standard := public.get_auto_approval_minutes_by_level(p_store_id, 'technician');
  v_approval_minutes_manager := public.get_auto_approval_minutes_by_level(p_store_id, 'manager');

  WITH updated_standard AS (
    UPDATE public.sale_tickets
    SET
      approval_deadline = closed_at + (v_approval_minutes_standard || ' minutes')::INTERVAL,
      updated_at = now()
    WHERE store_id = p_store_id
      AND approval_status = 'pending_approval'
      AND closed_at IS NOT NULL
      AND approval_required_level IN ('technician', 'supervisor')
    RETURNING id
  )
  SELECT count(*)
  INTO v_count_standard
  FROM updated_standard;

  WITH updated_manager AS (
    UPDATE public.sale_tickets
    SET
      approval_deadline = closed_at + (v_approval_minutes_manager || ' minutes')::INTERVAL,
      updated_at = now()
    WHERE store_id = p_store_id
      AND approval_status = 'pending_approval'
      AND closed_at IS NOT NULL
      AND approval_required_level = 'manager'
    RETURNING id
  )
  SELECT count(*)
  INTO v_count_manager
  FROM updated_manager;

  v_count_total := COALESCE(v_count_standard, 0) + COALESCE(v_count_manager, 0);

  RETURN jsonb_build_object(
    'success', true,
    'store_id', p_store_id,
    'updated_count_total', v_count_total,
    'updated_count_standard', COALESCE(v_count_standard, 0),
    'updated_count_manager', COALESCE(v_count_manager, 0),
    'approval_minutes_standard', v_approval_minutes_standard,
    'approval_minutes_manager', v_approval_minutes_manager,
    'message', format('Updated %s pending ticket(s) with new deadlines (%s standard, %s manager)',
      v_count_total,
      COALESCE(v_count_standard, 0),
      COALESCE(v_count_manager, 0))
  );
END;
$$;

-- Backfill all pending tickets across all stores to recalculate deadlines
DO $$
DECLARE
  v_store RECORD;
  v_result jsonb;
  v_total_updated integer := 0;
BEGIN
  FOR v_store IN 
    SELECT DISTINCT store_id 
    FROM public.sale_tickets 
    WHERE approval_status = 'pending_approval' 
      AND store_id IS NOT NULL
  LOOP
    v_result := public.update_pending_ticket_deadlines(v_store.store_id);
    v_total_updated := v_total_updated + COALESCE((v_result->>'updated_count_total')::integer, 0);
    RAISE NOTICE 'Store %: %', v_store.store_id, v_result->>'message';
  END LOOP;
  
  RAISE NOTICE 'Total tickets updated across all stores: %', v_total_updated;
END $$;