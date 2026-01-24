/*
  # Fix Trigger Functions Schema Qualification

  1. Overview
     - Adds explicit schema qualifications (public.) to all table references in trigger functions
     - Fixes the "relation does not exist" errors when closing tickets
     - Makes functions compatible with empty search_path security setting

  2. Functions Fixed
     - trigger_mark_technician_busy()
     - trigger_mark_technicians_available()
     - mark_technician_busy()

  3. Security
     - Maintains security by working with empty search_path
     - Prevents search_path manipulation attacks
*/

-- ============================================================================
-- FIX trigger_mark_technician_busy FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_mark_technician_busy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_ticket_closed_at timestamptz;
BEGIN
  -- Check if the ticket is still open
  SELECT closed_at INTO v_ticket_closed_at
  FROM public.sale_tickets
  WHERE id = NEW.sale_ticket_id;

  -- Only remove from queue if ticket is still open
  IF v_ticket_closed_at IS NULL THEN
    PERFORM public.mark_technician_busy(NEW.employee_id, NEW.sale_ticket_id);
  END IF;

  RETURN NEW;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.trigger_mark_technician_busy() SET search_path = '';

-- ============================================================================
-- FIX trigger_mark_technicians_available FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_mark_technicians_available()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only process if ticket was just closed (closed_at changed from NULL to a value)
  IF OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL THEN
    -- Remove all technicians who worked on this ticket from the queue
    DELETE FROM public.technician_ready_queue
    WHERE employee_id IN (
      SELECT employee_id 
      FROM public.ticket_items 
      WHERE sale_ticket_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.trigger_mark_technicians_available() SET search_path = '';

-- ============================================================================
-- FIX mark_technician_busy FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_technician_busy(
  p_employee_id uuid,
  p_ticket_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remove technician from ready queue when assigned to a ticket
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id;
END;
$$;

-- Set search_path to empty for security
ALTER FUNCTION public.mark_technician_busy(p_employee_id uuid, p_ticket_id uuid) SET search_path = '';

-- Add comments
COMMENT ON FUNCTION public.trigger_mark_technician_busy IS 'Trigger function to remove technician from queue when assigned to ticket. All tables fully qualified for security.';
COMMENT ON FUNCTION public.trigger_mark_technicians_available IS 'Trigger function to remove technicians from queue when ticket closes. All tables fully qualified for security.';
COMMENT ON FUNCTION public.mark_technician_busy IS 'Removes technician from ready queue. All tables fully qualified for security.';
