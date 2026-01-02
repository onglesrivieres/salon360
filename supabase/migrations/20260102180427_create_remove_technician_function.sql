/*
  # Create Admin Queue Removal Function
  
  ## Overview
  Creates a database function that allows managers to remove technicians from the queue
  with reason logging and automatic 30-minute cooldown enforcement.
  
  ## Function: remove_technician_from_queue_admin
  
  ### Parameters:
  - p_employee_id (uuid): The technician to remove
  - p_store_id (uuid): The store context
  - p_reason (text): Reason for removal (dropdown value)
  - p_notes (text): Optional additional notes
  
  ### Returns:
  - JSON object with success status and message
  
  ### Logic:
  1. Verify caller has Manager/Supervisor/Admin/Owner role
  2. Remove technician from technician_ready_queue
  3. Log removal to queue_removals_log with 30-minute cooldown
  4. Return success/failure status
*/

CREATE OR REPLACE FUNCTION public.remove_technician_from_queue_admin(
  p_employee_id uuid,
  p_store_id uuid,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removed_by_id uuid;
  v_removed_by_role text[];
  v_queue_record_exists boolean;
  v_removal_id uuid;
BEGIN
  -- Get caller's ID and role
  SELECT id, role INTO v_removed_by_id, v_removed_by_role
  FROM public.employees
  WHERE id = auth.uid();
  
  -- Check if caller has permission
  IF v_removed_by_id IS NULL OR NOT (v_removed_by_role && ARRAY['Manager', 'Supervisor', 'Admin', 'Owner']::text[]) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You do not have permission to remove technicians from the queue'
    );
  END IF;
  
  -- Check if caller has access to this store
  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_stores
    WHERE employee_id = v_removed_by_id
      AND store_id = p_store_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You do not have access to this store'
    );
  END IF;
  
  -- Check if technician is actually in the queue
  SELECT EXISTS (
    SELECT 1
    FROM public.technician_ready_queue
    WHERE employee_id = p_employee_id
      AND store_id = p_store_id
  ) INTO v_queue_record_exists;
  
  IF NOT v_queue_record_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Technician is not currently in the queue'
    );
  END IF;
  
  -- Validate reason
  IF p_reason NOT IN (
    'Rule violation',
    'Left work area without permission',
    'Not following queue policy',
    'Attendance policy violation',
    'Other'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid removal reason'
    );
  END IF;
  
  -- Remove from queue
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id;
  
  -- Log removal with 30-minute cooldown
  INSERT INTO public.queue_removals_log (
    employee_id,
    store_id,
    removed_by_employee_id,
    reason,
    notes,
    removed_at,
    cooldown_expires_at
  )
  VALUES (
    p_employee_id,
    p_store_id,
    v_removed_by_id,
    p_reason,
    p_notes,
    now(),
    now() + INTERVAL '30 minutes'
  )
  RETURNING id INTO v_removal_id;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Technician removed from queue with 30-minute cooldown',
    'removal_id', v_removal_id,
    'cooldown_expires_at', now() + INTERVAL '30 minutes'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error removing technician: ' || SQLERRM
    );
END;
$$;