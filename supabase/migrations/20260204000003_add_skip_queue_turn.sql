-- Skip queue turn: moves technician to end of queue by resetting ready_at to NOW()

CREATE OR REPLACE FUNCTION public.skip_queue_turn(
  p_employee_id uuid,
  p_store_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_queue_entry RECORD;
  v_new_position int;
  v_total int;
BEGIN
  -- Find the employee's queue entry
  SELECT * INTO v_queue_entry
  FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND status = 'ready';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not in ready queue');
  END IF;

  -- Update ready_at to now() to move to end of queue
  UPDATE public.technician_ready_queue
  SET ready_at = NOW(), updated_at = NOW()
  WHERE id = v_queue_entry.id;

  -- Calculate new position
  SELECT COUNT(*) INTO v_total
  FROM public.technician_ready_queue
  WHERE store_id = p_store_id AND status IN ('ready', 'small_service');

  RETURN jsonb_build_object('success', true, 'position', v_total, 'total', v_total);
END;
$$;
