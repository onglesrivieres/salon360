/*
  # Add No-Cooldown Queue Removal Reason

  ## Overview
  Adds a new "Queue adjustment" removal reason that does not apply the 30-minute
  cooldown penalty, allowing technicians to rejoin the queue immediately.

  ## Changes

  ### Tables
  - `queue_removals_log` - Updated CHECK constraint to include 'Queue adjustment'

  ### Functions
  - `remove_technician_from_queue_admin` - Conditionally sets cooldown based on reason
  - `get_queue_removal_history` - Added has_cooldown field to return data

  ## Notes
  - 'Queue adjustment' sets cooldown_expires_at to now() (instant expiration)
  - Other reasons continue to use 30-minute cooldown
*/

-- ============================================================================
-- UPDATE CHECK CONSTRAINT ON queue_removals_log
-- ============================================================================

ALTER TABLE public.queue_removals_log
DROP CONSTRAINT IF EXISTS queue_removals_log_reason_check;

ALTER TABLE public.queue_removals_log
ADD CONSTRAINT queue_removals_log_reason_check
CHECK (reason IN (
  'Rule violation',
  'Left work area without permission',
  'Not following queue policy',
  'Attendance policy violation',
  'Other',
  'Queue adjustment'
));

-- ============================================================================
-- UPDATE remove_technician_from_queue_admin FUNCTION
-- ============================================================================

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

  -- Validate reason (including new 'Queue adjustment' option)
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

-- NOTE: get_queue_removal_history function is handled by migration 20260124165327_fix_queue_history_permissions.sql
