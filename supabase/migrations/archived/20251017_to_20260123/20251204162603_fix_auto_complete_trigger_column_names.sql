/*
  # Fix Auto-Complete Trigger Column Names

  ## Overview
  Fixes column name errors in the auto_complete_previous_tickets trigger function.

  ## Changes
  1. Correct `ticket_number` to `ticket_no` (sale_tickets column name)
  2. Correct `action_type` to `action` (ticket_activity_log column name)

  ## Why
  The previous migration referenced non-existent columns, causing errors when creating new tickets.
*/

-- Drop and recreate the trigger function with correct column names
CREATE OR REPLACE FUNCTION auto_complete_previous_tickets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_store_id uuid;
  v_previous_ticket RECORD;
BEGIN
  -- Get the store_id from the new ticket
  SELECT store_id INTO v_store_id
  FROM sale_tickets
  WHERE id = NEW.sale_ticket_id;

  -- Find and complete any other open tickets for this employee in this store
  FOR v_previous_ticket IN
    SELECT DISTINCT st.id, st.ticket_no
    FROM sale_tickets st
    INNER JOIN ticket_items ti ON ti.sale_ticket_id = st.id
    WHERE ti.employee_id = NEW.employee_id
      AND st.store_id = v_store_id
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
      AND st.id != NEW.sale_ticket_id
  LOOP
    -- Mark the previous ticket as completed
    UPDATE sale_tickets
    SET
      completed_at = now(),
      completed_by = NEW.employee_id
    WHERE id = v_previous_ticket.id;

    -- Log the auto-completion activity
    INSERT INTO ticket_activity_log (
      ticket_id,
      action,
      description,
      changed_fields
    ) VALUES (
      v_previous_ticket.id,
      'updated',
      'Service auto-completed when technician was assigned to new ticket #' ||
        (SELECT ticket_no FROM sale_tickets WHERE id = NEW.sale_ticket_id),
      jsonb_build_object(
        'completed_at', now(),
        'completed_by', NEW.employee_id,
        'auto_completed', true,
        'new_ticket_id', NEW.sale_ticket_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;