/*
  # Trainee Queue Priority (Always Last in Queue)

  ## Overview
  Adds a queue_priority column to technician_ready_queue so Trainees are always
  positioned after Technicians. All queue ordering now uses (queue_priority, ready_at)
  instead of just ready_at.

  ## Changes

  ### Tables
  - `technician_ready_queue` - Added `queue_priority` integer column (0=normal, 1=low/trainee)

  ### Functions
  - `join_ready_queue_with_checkin` - Sets queue_priority based on employee role; priority-aware position calc
  - `check_queue_status` - Priority-aware position calculation
  - `is_last_in_ready_queue` - Priority-aware ordering
  - `get_sorted_technicians_for_store` - Adds Trainee to role filter; priority-aware sorting
  - `skip_queue_turn` - Priority-aware position calculation

  ## Notes
  - Priority 0 = normal (Technician, Supervisor, Manager, Owner, Receptionist)
  - Priority 1 = low (Trainee-only employees, always after priority 0)
  - Employees with both Trainee and Technician roles get priority 0
  - No frontend changes needed — positions are calculated server-side
*/

-- ============================================================================
-- ADD queue_priority COLUMN
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'technician_ready_queue'
      AND column_name = 'queue_priority'
  ) THEN
    ALTER TABLE public.technician_ready_queue
      ADD COLUMN queue_priority integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_technician_ready_queue_priority
  ON public.technician_ready_queue(queue_priority);

-- ============================================================================
-- FUNCTION: join_ready_queue_with_checkin (updated with queue_priority)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.join_ready_queue_with_checkin(p_employee_id uuid, p_store_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attendance record; v_today date; v_all_completed boolean; v_ticket_id uuid;
  v_position integer; v_total integer; v_ready_at timestamptz;
  v_cooldown_record record; v_minutes_remaining integer;
  v_employee_role text[]; v_priority integer;
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

  -- Check if employee has skip_queue_on_checkin enabled
  IF EXISTS (
    SELECT 1 FROM public.employees
    WHERE id = p_employee_id AND skip_queue_on_checkin = true
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'SKIP_QUEUE_ENABLED',
      'message', 'This employee is configured to check in without the queue',
      'position', 0, 'total', 0
    );
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

  -- Determine queue priority based on employee role
  SELECT role INTO v_employee_role FROM public.employees WHERE id = p_employee_id;
  v_priority := CASE
    WHEN v_employee_role @> ARRAY['Trainee']::text[]
         AND NOT v_employee_role && ARRAY['Technician','Supervisor','Manager','Owner','Receptionist']::text[]
    THEN 1 ELSE 0 END;

  -- Remove existing entry and add new with priority
  DELETE FROM public.technician_ready_queue WHERE employee_id = p_employee_id AND store_id = p_store_id;
  INSERT INTO public.technician_ready_queue (employee_id, store_id, status, ready_at, queue_priority)
  VALUES (p_employee_id, p_store_id, 'ready', NOW(), v_priority) RETURNING ready_at INTO v_ready_at;

  -- Calculate position (priority-aware)
  SELECT COUNT(*) + 1 INTO v_position FROM public.technician_ready_queue
  WHERE store_id = p_store_id AND status = 'ready'
    AND (queue_priority < v_priority OR (queue_priority = v_priority AND ready_at < v_ready_at));
  SELECT COUNT(*) INTO v_total FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready';

  RETURN json_build_object('success', true, 'position', v_position, 'total', v_total);
END;
$$;

-- ============================================================================
-- FUNCTION: check_queue_status (updated with priority-aware position)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_queue_status(p_employee_id uuid, p_store_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_in_queue boolean; v_position integer; v_total integer; v_ready_at timestamptz; v_priority integer;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.technician_ready_queue WHERE employee_id = p_employee_id AND store_id = p_store_id AND status = 'ready'),
         ready_at, queue_priority
  INTO v_in_queue, v_ready_at, v_priority
  FROM public.technician_ready_queue WHERE employee_id = p_employee_id AND store_id = p_store_id AND status = 'ready';

  IF v_in_queue THEN
    SELECT COUNT(*) + 1 INTO v_position FROM public.technician_ready_queue
    WHERE store_id = p_store_id AND status = 'ready'
      AND (queue_priority < v_priority OR (queue_priority = v_priority AND ready_at < v_ready_at));
    SELECT COUNT(*) INTO v_total FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready';
  ELSE v_position := 0; v_total := 0; END IF;

  RETURN json_build_object('in_queue', v_in_queue, 'position', v_position, 'total', v_total);
END;
$$;

-- ============================================================================
-- FUNCTION: is_last_in_ready_queue (updated with priority-aware ordering)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_last_in_ready_queue(p_employee_id uuid, p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_max_position integer; v_tech_position integer;
BEGIN
  SELECT COUNT(*) INTO v_max_position FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready';
  SELECT pos INTO v_tech_position FROM (
    SELECT employee_id, ROW_NUMBER() OVER (ORDER BY queue_priority ASC, ready_at ASC) as pos
    FROM public.technician_ready_queue WHERE store_id = p_store_id AND status = 'ready'
  ) q WHERE q.employee_id = p_employee_id;
  RETURN v_tech_position = v_max_position AND v_max_position IS NOT NULL;
END;
$$;

-- ============================================================================
-- FUNCTION: get_sorted_technicians_for_store (updated with Trainee role + priority)
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
    SELECT trq.employee_id, trq.status as queue_status_raw, trq.ready_at, trq.current_open_ticket_id, trq.queue_priority
    FROM public.technician_ready_queue trq WHERE trq.store_id = p_store_id
  ),
  filtered_technicians AS (
    SELECT e.id as employee_id, e.display_name, e.role,
      CASE WHEN qs.queue_status_raw = 'small_service' THEN 'small_service'::text
           WHEN qs.queue_status_raw = 'busy' THEN 'busy'::text
           WHEN ct.employee_id IS NOT NULL THEN 'busy'::text
           WHEN qs.queue_status_raw = 'ready' THEN 'ready'::text
           ELSE 'neutral'::text END as queue_status,
      qs.ready_at, COALESCE(qs.queue_priority, 0) as queue_priority,
      COALESCE(qs.current_open_ticket_id, ct.ticket_id) as current_ticket_id,
      ct.customer_name as ticket_customer_name, ct.start_time as ticket_start_time,
      ed.total_estimated_min::integer as estimated_duration_min, ct.elapsed_min::integer as time_elapsed_min,
      GREATEST(0, COALESCE(ed.total_estimated_min, 0) - COALESCE(ct.elapsed_min, 0))::integer as time_remaining_min
    FROM public.employees e
    LEFT JOIN all_queue_status qs ON qs.employee_id = e.id
    LEFT JOIN current_tickets ct ON ct.employee_id = e.id
    LEFT JOIN estimated_durations ed ON ed.employee_id = e.id
    WHERE LOWER(e.status) = 'active'
      AND (e.role @> ARRAY['Technician']::text[] OR e.role @> ARRAY['Supervisor']::text[]
           OR e.role @> ARRAY['Manager']::text[] OR e.role @> ARRAY['Owner']::text[]
           OR e.role @> ARRAY['Receptionist']::text[] OR e.role @> ARRAY['Trainee']::text[])
      AND NOT e.role @> ARRAY['Cashier']::text[]
      AND EXISTS (SELECT 1 FROM public.employee_stores es WHERE es.employee_id = e.id AND es.store_id = p_store_id)
      AND (
        -- Checked in at THIS store -> always show
        EXISTS (SELECT 1 FROM public.attendance_records ar WHERE ar.employee_id = e.id
                AND ar.store_id = p_store_id AND ar.work_date = p_date::date AND ar.status = 'checked_in')
        OR (
          -- Scheduled to work today AND NOT checked in at any other store
          COALESCE((e.weekly_schedule->v_day_name->>'is_working')::boolean, false) = true
          AND NOT EXISTS (SELECT 1 FROM public.attendance_records ar WHERE ar.employee_id = e.id
                          AND ar.store_id != p_store_id AND ar.work_date = p_date::date AND ar.status = 'checked_in')
        )
      )
  )
  SELECT ft.employee_id, ft.display_name, ft.role, ft.queue_status,
    CASE WHEN ft.queue_status IN ('ready', 'small_service') THEN
      ROW_NUMBER() OVER (PARTITION BY (ft.queue_status IN ('ready', 'small_service')) ORDER BY ft.queue_priority ASC, ft.ready_at ASC NULLS LAST)::integer
    ELSE NULL END as queue_position,
    ft.current_ticket_id, ft.ticket_customer_name, ft.ticket_start_time,
    ft.estimated_duration_min, ft.time_elapsed_min, ft.time_remaining_min
  FROM filtered_technicians ft
  ORDER BY CASE WHEN ft.queue_status IN ('ready', 'small_service') THEN 1 WHEN ft.queue_status = 'neutral' THEN 2 ELSE 3 END,
           ft.queue_priority ASC, ft.ready_at ASC NULLS LAST, ft.display_name;
END;
$$;

-- ============================================================================
-- FUNCTION: skip_queue_turn (updated with priority-aware position)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.skip_queue_turn(
  p_employee_id uuid,
  p_store_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_queue_entry RECORD;
  v_new_position int;
  v_total int;
  v_priority int;
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

  v_priority := v_queue_entry.queue_priority;

  -- Update ready_at to now() to move to end of queue (within same priority group)
  UPDATE public.technician_ready_queue
  SET ready_at = NOW(), updated_at = NOW()
  WHERE id = v_queue_entry.id;

  -- Calculate new position (priority-aware)
  SELECT COUNT(*) INTO v_total
  FROM public.technician_ready_queue
  WHERE store_id = p_store_id AND status IN ('ready', 'small_service');

  SELECT COUNT(*) + 1 INTO v_new_position
  FROM public.technician_ready_queue
  WHERE store_id = p_store_id AND status IN ('ready', 'small_service')
    AND employee_id != p_employee_id
    AND (queue_priority < v_priority OR (queue_priority = v_priority AND ready_at < NOW()));

  RETURN jsonb_build_object('success', true, 'position', v_new_position, 'total', v_total);
END;
$$;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
