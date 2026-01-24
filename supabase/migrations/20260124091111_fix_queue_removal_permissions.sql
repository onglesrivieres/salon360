/*
  # Fix Queue Removal Permissions

  ## Overview
  Fixes the `remove_technician_from_queue_admin` function to:
  1. Accept p_removed_by_employee_id parameter (since auth.uid() returns NULL in PIN-based auth)
  2. Add Receptionist to allowed roles

  ## Changes

  ### Functions
  - `remove_technician_from_queue_admin` - Accept p_removed_by_employee_id, add Receptionist role

  ## Notes
  - Salon360 uses PIN-based authentication, not Supabase's built-in auth
  - auth.uid() returns NULL, causing all permission checks to fail
  - The fix passes employee_id from the frontend session
*/

-- ============================================================================
-- FIX remove_technician_from_queue_admin FUNCTION
-- ============================================================================

-- Must drop first because we're changing the function signature
DROP FUNCTION IF EXISTS public.remove_technician_from_queue_admin(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.remove_technician_from_queue_admin(
  p_removed_by_employee_id uuid,
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
  v_cooldown_expires timestamptz;
  v_has_cooldown boolean;
BEGIN
  -- Get caller's ID and role using the passed employee_id (not auth.uid())
  SELECT id, role INTO v_removed_by_id, v_removed_by_role
  FROM public.employees
  WHERE id = p_removed_by_employee_id;

  -- Check if caller has permission (Receptionist, Supervisor, Manager, Admin, Owner)
  IF v_removed_by_id IS NULL OR NOT (v_removed_by_role && ARRAY['Receptionist', 'Supervisor', 'Manager', 'Admin', 'Owner']::text[]) THEN
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

  -- Validate reason (including 'Queue adjustment' option)
  IF p_reason NOT IN (
    'Rule violation',
    'Left work area without permission',
    'Not following queue policy',
    'Attendance policy violation',
    'Other',
    'Queue adjustment'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid removal reason'
    );
  END IF;

  -- Determine cooldown based on reason
  IF p_reason = 'Queue adjustment' THEN
    -- No cooldown - set to current time (already expired)
    v_cooldown_expires := now();
    v_has_cooldown := false;
  ELSE
    -- Standard 30-minute cooldown
    v_cooldown_expires := now() + INTERVAL '30 minutes';
    v_has_cooldown := true;
  END IF;

  -- Remove from queue
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id;

  -- Log removal with appropriate cooldown
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
    v_cooldown_expires
  )
  RETURNING id INTO v_removal_id;

  -- Return success with cooldown info
  RETURN json_build_object(
    'success', true,
    'message', CASE WHEN v_has_cooldown
      THEN 'Technician removed from queue with 30-minute cooldown'
      ELSE 'Technician removed from queue (no cooldown)'
    END,
    'removal_id', v_removal_id,
    'cooldown_expires_at', v_cooldown_expires,
    'has_cooldown', v_has_cooldown
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error removing technician: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.remove_technician_from_queue_admin IS 'Removes a technician from the queue with reason tracking and optional cooldown. Requires p_removed_by_employee_id for permission validation. Accessible to Receptionist, Supervisor, Manager, Admin, and Owner roles.';
