/*
  # Fix Activity Log Column Name in Auto-Complete Trigger

  ## Overview
  Fixes the column name `changed_fields` to `changes` in the auto_complete_previous_tickets trigger function.
  The ticket_activity_log table uses `changes` (jsonb) column, not `changed_fields`.

  ## Changes
  1. Update auto_complete_previous_tickets() function to use correct column name `changes`

  ## Why
  The previous migration still referenced `changed_fields` causing errors:
  "column 'changed_fields' of relation 'ticket_activity_log' does not exist"
  when creating new tickets with employee assignments.

  ## Impact
  - Fixes database errors during ticket creation
  - Allows activity logs to be properly created when tickets are auto-completed
*/

-- Drop and recreate the trigger function with correct column name
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

    -- Log the auto-completion activity (using correct column name: changes)
    INSERT INTO ticket_activity_log (
      ticket_id,
      action,
      description,
      changes
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