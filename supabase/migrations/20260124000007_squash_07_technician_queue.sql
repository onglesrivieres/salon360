/*
  # Squashed Migration: Technician Queue

  ## Overview
  This migration consolidates technician queue migrations for the
  ready queue system with smart turn division and removal tracking.

  ## Tables Created
  - technician_ready_queue: Queue status per technician
  - queue_removals_log: Audit trail for queue removals

  ## Functions Created
  - join_ready_queue_with_checkin: Join queue with validation
  - leave_ready_queue: Leave queue
  - check_queue_status: Get queue position
  - get_sorted_technicians_for_store: Queue display function
  - mark_technician_busy_smart: Smart busy status
  - remove_technician_from_queue_admin: Admin removal with cooldown
*/

-- ============================================================================
-- TABLE: technician_ready_queue
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.technician_ready_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  ready_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'busy', 'small_service')),
  current_open_ticket_id uuid REFERENCES public.sale_tickets(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_technician_ready_queue_employee_id ON public.technician_ready_queue(employee_id);
CREATE INDEX IF NOT EXISTS idx_technician_ready_queue_store_id ON public.technician_ready_queue(store_id);
CREATE INDEX IF NOT EXISTS idx_technician_ready_queue_ready_at ON public.technician_ready_queue(ready_at);
CREATE INDEX IF NOT EXISTS idx_technician_ready_queue_status ON public.technician_ready_queue(status);

ALTER TABLE public.technician_ready_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to technician_ready_queue" ON public.technician_ready_queue;
CREATE POLICY "Allow all access to technician_ready_queue"
  ON public.technician_ready_queue FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TABLE: queue_removals_log
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.queue_removals_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  removed_by_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'Rule violation', 'Left work area without permission',
    'Not following queue policy', 'Attendance policy violation', 'Other'
  )),
  notes text,
  removed_at timestamptz NOT NULL DEFAULT now(),
  cooldown_expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_removals_employee_id ON public.queue_removals_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_queue_removals_store_id ON public.queue_removals_log(store_id);
CREATE INDEX IF NOT EXISTS idx_queue_removals_cooldown_expires ON public.queue_removals_log(cooldown_expires_at);

ALTER TABLE public.queue_removals_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to queue_removals_log" ON public.queue_removals_log;
CREATE POLICY "Allow all access to queue_removals_log"
  ON public.queue_removals_log FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_small_service_threshold(p_store_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_threshold numeric;
BEGIN
  SELECT (setting_value)::numeric INTO v_threshold
  FROM public.app_settings WHERE store_id = p_store_id AND setting_key = 'small_service_threshold';
  RETURN COALESCE(v_threshold, 30);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_last_in_ready_queue(p_employee_id uuid, p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_max_position integer; v_tech_position integer;
BEGIN
  SELECT COUNT(*) INTO v_max_position FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready';
  SELECT pos INTO v_tech_position FROM (
    SELECT employee_id, ROW_NUMBER() OVER (ORDER BY ready_at ASC) as pos
    FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready'
  ) q WHERE q.employee_id = p_employee_id;
  RETURN v_tech_position = v_max_position AND v_max_position IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_ticket_total(p_ticket_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_total numeric;
BEGIN
  SELECT COALESCE(SUM((qty * price_each) + COALESCE(addon_price, 0)), 0) INTO v_total
  FROM public.ticket_items WHERE sale_ticket_id = p_ticket_id;
  RETURN v_total;
END;
$$;

-- ============================================================================
-- FUNCTION: check_queue_status
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_queue_status(p_employee_id uuid, p_store_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_in_queue boolean; v_position integer; v_total integer; v_ready_at timestamptz;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.technician_ready_queue WHERE employee_id = p_employee_id AND store_id = p_store_id AND status = 'ready'), ready_at
  INTO v_in_queue, v_ready_at FROM public.technician_ready_queue WHERE employee_id = p_employee_id AND store_id = p_store_id AND status = 'ready';

  IF v_in_queue THEN
    SELECT COUNT(*) + 1 INTO v_position FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready' AND ready_at < v_ready_at;
    SELECT COUNT(*) INTO v_total FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready';
  ELSE v_position := 0; v_total := 0; END IF;

  RETURN json_build_object('in_queue', v_in_queue, 'position', v_position, 'total', v_total);
END;
$$;

-- ============================================================================
-- FUNCTION: leave_ready_queue
-- ============================================================================
CREATE OR REPLACE FUNCTION public.leave_ready_queue(p_employee_id uuid, p_store_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.technician_ready_queue WHERE employee_id = p_employee_id AND store_id = p_store_id;
END;
$$;

-- ============================================================================
-- FUNCTION: join_ready_queue_with_checkin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.join_ready_queue_with_checkin(p_employee_id uuid, p_store_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attendance record; v_today date; v_all_completed boolean; v_ticket_id uuid;
  v_position integer; v_total integer; v_ready_at timestamptz;
  v_cooldown_record record; v_minutes_remaining integer;
BEGIN
  v_today := CURRENT_DATE;

  -- Check cooldown
  SELECT qrl.cooldown_expires_at, qrl.reason, qrl.notes, e.display_name as removed_by_name,
         EXTRACT(EPOCH FROM (qrl.cooldown_expires_at - now())) / 60 as minutes_remaining
  INTO v_cooldown_record
  FROM public.queue_removals_log qrl JOIN public.employees e ON e.id = qrl.removed_by_employee_id
  WHERE qrl.employee_id = p_employee_id AND qrl.store_id = p_store_id AND qrl.cooldown_expires_at > now()
  ORDER BY qrl.removed_at DESC LIMIT 1;

  IF v_cooldown_record IS NOT NULL THEN
    v_minutes_remaining := CEIL(v_cooldown_record.minutes_remaining);
    RETURN json_build_object('success', false, 'error', 'COOLDOWN_ACTIVE',
      'message', format('Cannot join queue for %s more minutes. Removed for: %s', v_minutes_remaining, v_cooldown_record.reason),
      'cooldown_expires_at', v_cooldown_record.cooldown_expires_at, 'minutes_remaining', v_minutes_remaining, 'position', 0, 'total', 0);
  END IF;

  -- Check attendance
  SELECT * INTO v_attendance FROM public.attendance_records
  WHERE employee_id = p_employee_id AND store_id = p_store_id AND work_date = v_today AND status = 'checked_in'
  ORDER BY check_in_time DESC LIMIT 1;

  IF v_attendance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'CHECK_IN_REQUIRED', 'message', 'Must check in before joining queue', 'position', 0, 'total', 0);
  END IF;

  -- Mark services as completed
  UPDATE public.ticket_items ti SET completed_at = NOW(), completed_by = p_employee_id, updated_at = NOW()
  WHERE ti.employee_id = p_employee_id AND ti.completed_at IS NULL
    AND EXISTS (SELECT 1 FROM public.sale_tickets st WHERE st.id = ti.sale_ticket_id AND st.store_id = p_store_id AND st.closed_at IS NULL);

  -- Check if tickets should be marked completed
  FOR v_ticket_id IN (SELECT DISTINCT ti.sale_ticket_id FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = p_employee_id AND st.store_id = p_store_id AND st.closed_at IS NULL AND st.completed_at IS NULL)
  LOOP
    v_all_completed := public.check_ticket_all_services_completed(v_ticket_id);
    IF v_all_completed THEN
      UPDATE public.sale_tickets SET completed_at = NOW(), completed_by = p_employee_id, updated_at = NOW()
      WHERE id = v_ticket_id AND completed_at IS NULL;
    END IF;
  END LOOP;

  -- Remove existing entry and add new
  DELETE FROM public.technician_ready_queue WHERE employee_id = p_employee_id AND store_id = p_store_id;
  INSERT INTO public.technician_ready_queue (employee_id, store_id, status, ready_at)
  VALUES (p_employee_id, p_store_id, 'ready', NOW()) RETURNING ready_at INTO v_ready_at;

  -- Calculate position
  SELECT COUNT(*) + 1 INTO v_position FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready' AND ready_at < v_ready_at;
  SELECT COUNT(*) INTO v_total FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready';

  RETURN json_build_object('success', true, 'position', v_position, 'total', v_total);
END;
$$;

-- ============================================================================
-- FUNCTION: mark_technician_busy_smart
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_technician_busy_smart(p_employee_id uuid, p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_store_id uuid; v_threshold numeric; v_ticket_total numeric; v_current_status text; v_new_status text;
BEGIN
  SELECT store_id INTO v_store_id FROM public.sale_tickets WHERE id = p_ticket_id;
  IF v_store_id IS NULL THEN RETURN; END IF;

  SELECT status INTO v_current_status FROM public.technician_ready_queue WHERE employee_id = p_employee_id AND store_id = v_store_id;
  IF v_current_status IS NULL THEN RETURN; END IF;
  IF v_current_status = 'busy' THEN
    UPDATE public.technician_ready_queue SET current_open_ticket_id = p_ticket_id, updated_at = now() WHERE employee_id = p_employee_id AND store_id = v_store_id;
    RETURN;
  END IF;

  v_ticket_total := public.calculate_ticket_total(p_ticket_id);
  v_threshold := public.get_small_service_threshold(v_store_id);

  IF v_ticket_total < v_threshold THEN v_new_status := 'small_service'; ELSE v_new_status := 'busy'; END IF;
  IF v_current_status = 'small_service' AND v_ticket_total >= v_threshold THEN v_new_status := 'busy'; END IF;

  UPDATE public.technician_ready_queue SET status = v_new_status, current_open_ticket_id = p_ticket_id, updated_at = now()
  WHERE employee_id = p_employee_id AND store_id = v_store_id;
END;
$$;

-- ============================================================================
-- FUNCTION: handle_ticket_close_smart
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_ticket_close_smart(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.technician_ready_queue SET status = 'ready', current_open_ticket_id = NULL, updated_at = now()
  WHERE current_open_ticket_id = p_ticket_id AND status = 'small_service';
  DELETE FROM public.technician_ready_queue WHERE current_open_ticket_id = p_ticket_id AND status = 'busy';
END;
$$;

-- ============================================================================
-- FUNCTION: get_sorted_technicians_for_store
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_sorted_technicians_for_store(p_store_id uuid, p_date text)
RETURNS TABLE (
  employee_id uuid, display_name text, role text[], queue_status text,
  queue_position integer, current_ticket_id uuid, ticket_customer_name text,
  ticket_start_time timestamptz, estimated_duration_min integer,
  time_elapsed_min integer, time_remaining_min integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_day_name text;
BEGIN
  v_day_name := CASE EXTRACT(DOW FROM p_date::date)::integer
    WHEN 0 THEN 'sunday' WHEN 1 THEN 'monday' WHEN 2 THEN 'tuesday' WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday' WHEN 5 THEN 'friday' WHEN 6 THEN 'saturday' END;

  RETURN QUERY
  WITH employees_with_open_tickets AS (
    SELECT DISTINCT ti.employee_id FROM public.sale_tickets st
    JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id AND st.ticket_date = p_date::date AND st.closed_at IS NULL AND st.completed_at IS NULL
  ),
  current_tickets AS (
    SELECT DISTINCT ON (ti.employee_id) ti.employee_id, st.id as ticket_id, st.customer_name, st.opened_at as start_time,
           EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - st.opened_at))/60 as elapsed_min
    FROM public.sale_tickets st JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id AND st.ticket_date = p_date::date AND st.closed_at IS NULL AND st.completed_at IS NULL
    ORDER BY ti.employee_id, st.opened_at ASC
  ),
  estimated_durations AS (
    SELECT ti.employee_id, SUM(COALESCE(ss.duration_min, 0)) as total_estimated_min
    FROM public.ticket_items ti LEFT JOIN public.store_services ss ON ss.id = ti.store_service_id
    JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE st.store_id = p_store_id AND st.ticket_date = p_date::date AND st.closed_at IS NULL AND st.completed_at IS NULL
    GROUP BY ti.employee_id
  ),
  all_queue_status AS (
    SELECT trq.employee_id, trq.status as queue_status_raw, trq.ready_at, trq.current_open_ticket_id
    FROM public.technician_ready_queue trq WHERE trq.store_id = p_store_id
  ),
  filtered_technicians AS (
    SELECT e.id as employee_id, e.display_name, e.role,
      CASE WHEN qs.queue_status_raw = 'small_service' THEN 'small_service'::text
           WHEN qs.queue_status_raw = 'busy' THEN 'busy'::text
           WHEN ct.employee_id IS NOT NULL THEN 'busy'::text
           WHEN qs.queue_status_raw = 'ready' THEN 'ready'::text
           ELSE 'neutral'::text END as queue_status,
      qs.ready_at, COALESCE(qs.current_open_ticket_id, ct.ticket_id) as current_ticket_id,
      ct.customer_name as ticket_customer_name, ct.start_time as ticket_start_time,
      ed.total_estimated_min::integer as estimated_duration_min, ct.elapsed_min::integer as time_elapsed_min,
      GREATEST(0, COALESCE(ed.total_estimated_min, 0) - COALESCE(ct.elapsed_min, 0))::integer as time_remaining_min
    FROM public.employees e
    LEFT JOIN all_queue_status qs ON qs.employee_id = e.id
    LEFT JOIN current_tickets ct ON ct.employee_id = e.id
    LEFT JOIN estimated_durations ed ON ed.employee_id = e.id
    WHERE LOWER(e.status) = 'active'
      AND (e.role @> ARRAY['Technician']::text[] OR e.role @> ARRAY['Supervisor']::text[]
           OR e.role @> ARRAY['Manager']::text[] OR e.role @> ARRAY['Owner']::text[])
      AND NOT e.role @> ARRAY['Cashier']::text[]
      AND EXISTS (SELECT 1 FROM public.employee_stores es WHERE es.employee_id = e.id AND es.store_id = p_store_id)
      AND (COALESCE((e.weekly_schedule->v_day_name->>'is_working')::boolean, false) = true
           OR EXISTS (SELECT 1 FROM public.attendance_records ar WHERE ar.employee_id = e.id
                      AND ar.store_id = p_store_id AND ar.work_date = p_date::date AND ar.status = 'checked_in'))
  )
  SELECT ft.employee_id, ft.display_name, ft.role, ft.queue_status,
    CASE WHEN ft.queue_status IN ('ready', 'small_service') THEN
      ROW_NUMBER() OVER (PARTITION BY (ft.queue_status IN ('ready', 'small_service')) ORDER BY ft.ready_at ASC NULLS LAST)::integer
    ELSE NULL END as queue_position,
    ft.current_ticket_id, ft.ticket_customer_name, ft.ticket_start_time,
    ft.estimated_duration_min, ft.time_elapsed_min, ft.time_remaining_min
  FROM filtered_technicians ft
  ORDER BY CASE WHEN ft.queue_status IN ('ready', 'small_service') THEN 1 WHEN ft.queue_status = 'neutral' THEN 2 ELSE 3 END,
           ft.ready_at ASC NULLS LAST, ft.display_name;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trigger_mark_technician_busy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_ticket_closed_at timestamptz;
BEGIN
  SELECT closed_at INTO v_ticket_closed_at FROM public.sale_tickets WHERE id = NEW.sale_ticket_id;
  IF v_ticket_closed_at IS NULL THEN PERFORM public.mark_technician_busy_smart(NEW.employee_id, NEW.sale_ticket_id); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ticket_items_mark_busy ON public.ticket_items;
CREATE TRIGGER ticket_items_mark_busy
  AFTER INSERT ON public.ticket_items FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_technician_busy();

CREATE OR REPLACE FUNCTION public.trigger_mark_technicians_available()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    PERFORM public.handle_ticket_close_smart(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sale_tickets_mark_available ON public.sale_tickets;
CREATE TRIGGER sale_tickets_mark_available
  AFTER UPDATE OF completed_at ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_technicians_available();

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
