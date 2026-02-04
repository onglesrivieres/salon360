/*
  # Add Leave Queue Reason Logging

  ## Overview
  Creates a queue_leave_log table to record voluntary queue departures with reasons,
  and updates the leave_ready_queue RPC to accept and log reason/notes parameters.

  ## Changes

  ### Tables
  - `queue_leave_log` - New table to track voluntary queue leaves with reasons

  ### Functions
  - `leave_ready_queue` - Updated to accept optional p_reason and p_notes parameters

  ## Security
  - Table accessed via SECURITY DEFINER function (leave_ready_queue)
  - RLS enabled with permissive policy for SECURITY DEFINER access
*/

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.queue_leave_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('Tired', 'Cannot perform service', 'Other')),
  notes text,
  left_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_queue_leave_log_employee_id ON public.queue_leave_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_queue_leave_log_store_id ON public.queue_leave_log(store_id);
CREATE INDEX IF NOT EXISTS idx_queue_leave_log_left_at ON public.queue_leave_log(left_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.queue_leave_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.leave_ready_queue(
  p_employee_id uuid,
  p_store_id uuid,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id AND store_id = p_store_id;

  IF p_reason IS NOT NULL THEN
    INSERT INTO public.queue_leave_log (employee_id, store_id, reason, notes)
    VALUES (p_employee_id, p_store_id, p_reason, p_notes);
  END IF;
END;
$$;
