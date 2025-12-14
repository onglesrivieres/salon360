/*
  # Fix Auto-Approval to Respect Store Settings

  ## Overview
  Updates the auto_approve_expired_tickets() function to only auto-approve tickets
  for stores that have the auto-approval feature enabled.

  ## Problem
  The current function auto-approves ALL tickets past their deadline, regardless of
  whether the store has enabled auto-approval via the `auto_approve_after_48_hours` setting.

  ## Solution
  1. Join with app_settings to check if auto_approve_after_48_hours = true for each store
  2. Only auto-approve tickets where the store has this setting enabled
  3. Return detailed results showing which stores were processed

  ## Changes Made
  
  1. **Function Logic Update**
     - Add join to app_settings table
     - Filter by stores where auto_approve_after_48_hours is true (JSONB boolean)
     - Maintain existing filters (pending_approval, deadline passed, no manual approval)
  
  2. **Improved Return Value**
     - Return count of auto-approved tickets
     - Return list of stores processed
     - Include timestamp for monitoring

  ## Security
  - Function uses SECURITY DEFINER to access all stores
  - No RLS changes needed
*/

-- Update the auto-approve function to respect store settings
CREATE OR REPLACE FUNCTION public.auto_approve_expired_tickets()
RETURNS json 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
  v_stores_processed uuid[];
BEGIN
  -- Auto-approve tickets past their deadline
  -- ONLY for stores that have auto_approve_after_48_hours enabled
  -- AND only if they haven't been manually approved already
  WITH eligible_tickets AS (
    SELECT t.id, t.store_id
    FROM public.sale_tickets t
    INNER JOIN public.app_settings a 
      ON t.store_id = a.store_id 
      AND a.setting_key = 'auto_approve_after_48_hours'
      AND a.setting_value = to_jsonb(true)
    WHERE t.approval_status = 'pending_approval'
      AND t.approval_deadline < now()
      AND t.approved_by IS NULL
  ),
  updated AS (
    UPDATE public.sale_tickets st
    SET 
      approval_status = 'auto_approved',
      approved_at = now(),
      updated_at = now()
    FROM eligible_tickets et
    WHERE st.id = et.id
    RETURNING st.id, st.store_id
  )
  SELECT 
    count(*),
    array_agg(DISTINCT store_id)
  INTO v_count, v_stores_processed
  FROM updated;
  
  RETURN json_build_object(
    'success', true, 
    'message', format('Auto-approved %s ticket(s)', COALESCE(v_count, 0)),
    'count', COALESCE(v_count, 0),
    'stores_processed', COALESCE(v_stores_processed, ARRAY[]::uuid[]),
    'executed_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.auto_approve_expired_tickets() IS 
'Auto-approves tickets past their approval deadline. Only processes stores where auto_approve_after_48_hours setting is enabled. Skips tickets that already have approved_by set (manual approvals).';
