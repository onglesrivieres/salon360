/*
  # Add Auto-Complete Previous Ticket Trigger

  ## Overview
  Creates a database trigger to automatically complete a technician's previous open tickets
  when they are assigned to a new ticket. This replaces the frontend auto-complete logic
  and ensures all ticket assignments (receptionist and self-serve) trigger auto-completion.

  ## Changes
  1. Create trigger function to auto-complete previous tickets
  2. Attach trigger to ticket_items table
  3. Add activity logging for auto-completed tickets

  ## How it Works
  - Fires AFTER INSERT on ticket_items table
  - Finds any other open tickets for the same employee in the same store
  - Sets completed_at to current timestamp
  - Sets completed_by to the employee who completed the service
  - Logs activity for transparency
  - Previous trigger already handles removing from queue

  ## Benefits
  - Works for both receptionist-assigned and self-serve tickets
  - Automatic and consistent
  - Simpler frontend code
  - Cannot be bypassed by closing the dialog
*/

-- Trigger function: Auto-complete previous tickets when technician is assigned to new ticket
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
    SELECT DISTINCT st.id, st.ticket_number
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
      action_type,
      description,
      changed_fields
    ) VALUES (
      v_previous_ticket.id,
      'updated',
      'Service auto-completed when technician was assigned to new ticket #' ||
        (SELECT ticket_number FROM sale_tickets WHERE id = NEW.sale_ticket_id),
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

-- Create trigger on ticket_items for auto-completing previous tickets
DROP TRIGGER IF EXISTS ticket_items_auto_complete_previous ON ticket_items;
CREATE TRIGGER ticket_items_auto_complete_previous
  AFTER INSERT ON ticket_items
  FOR EACH ROW
  EXECUTE FUNCTION auto_complete_previous_tickets();
