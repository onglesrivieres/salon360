-- Update queue skip/leave reasons: new reason options + queue_skip_log table

-- 1. Update queue_leave_log CHECK constraint to include new reason values
-- Drop old constraint and add new one that includes both old and new values
ALTER TABLE public.queue_leave_log DROP CONSTRAINT IF EXISTS queue_leave_log_reason_check;
ALTER TABLE public.queue_leave_log ADD CONSTRAINT queue_leave_log_reason_check
  CHECK (reason IN ('Tired', 'Cannot perform service', 'Other', 'Too difficult', 'Health', 'Lunch', 'Washroom', 'Others'));

-- 2. Create queue_skip_log table (mirrors queue_leave_log structure)
CREATE TABLE IF NOT EXISTS public.queue_skip_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('Too difficult', 'Health', 'Lunch', 'Washroom', 'Others')),
  notes text,
  skipped_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_skip_log_employee_id ON public.queue_skip_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_queue_skip_log_store_id ON public.queue_skip_log(store_id);
CREATE INDEX IF NOT EXISTS idx_queue_skip_log_skipped_at ON public.queue_skip_log(skipped_at DESC);

ALTER TABLE public.queue_skip_log ENABLE ROW LEVEL SECURITY;

-- 3. Update skip_queue_turn RPC to accept reason and notes
CREATE OR REPLACE FUNCTION public.skip_queue_turn(
  p_employee_id uuid,
  p_store_id uuid,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
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

  -- Log the skip if reason is provided
  IF p_reason IS NOT NULL THEN
    INSERT INTO public.queue_skip_log (employee_id, store_id, reason, notes)
    VALUES (p_employee_id, p_store_id, p_reason, p_notes);
  END IF;

  -- Calculate new position
  SELECT COUNT(*) INTO v_total
  FROM public.technician_ready_queue
  WHERE store_id = p_store_id AND status IN ('ready', 'small_service');

  RETURN jsonb_build_object('success', true, 'position', v_total, 'total', v_total);
END;
$$;
