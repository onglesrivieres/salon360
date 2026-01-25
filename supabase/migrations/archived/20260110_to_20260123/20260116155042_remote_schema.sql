alter table "public"."safe_balance_history" drop constraint "unique_store_date";

alter table "public"."store_service_categories" drop constraint "store_service_categories_valid_color";

alter table "public"."approval_status_correction_audit" drop constraint "approval_status_correction_audit_ticket_id_fkey";

alter table "public"."end_of_day_records" drop constraint "end_of_day_records_created_by_fkey";

alter table "public"."end_of_day_records" drop constraint "end_of_day_records_updated_by_fkey";

drop function if exists "public"."get_pending_approvals_for_management"(p_store_id uuid);

drop function if exists "public"."get_pending_approvals_for_supervisor"(p_employee_id uuid, p_store_id uuid);

drop function if exists "public"."get_pending_approvals_for_technician"(p_employee_id uuid, p_store_id uuid);

drop index if exists "public"."unique_store_date";

CREATE UNIQUE INDEX unique_safe_balance_store_date ON public.safe_balance_history USING btree (store_id, date);

alter table "public"."safe_balance_history" add constraint "unique_safe_balance_store_date" UNIQUE using index "unique_safe_balance_store_date";

alter table "public"."approval_status_correction_audit" add constraint "approval_status_correction_audit_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.sale_tickets(id) ON DELETE CASCADE not valid;

alter table "public"."approval_status_correction_audit" validate constraint "approval_status_correction_audit_ticket_id_fkey";

alter table "public"."end_of_day_records" add constraint "end_of_day_records_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.employees(id) not valid;

alter table "public"."end_of_day_records" validate constraint "end_of_day_records_created_by_fkey";

alter table "public"."end_of_day_records" add constraint "end_of_day_records_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.employees(id) not valid;

alter table "public"."end_of_day_records" validate constraint "end_of_day_records_updated_by_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_ticket_delete_queue_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'technician_ready_queue'
  ) THEN
    DELETE FROM technician_ready_queue
    WHERE current_open_ticket_id = OLD.id;
  END IF;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.save_safe_balance_snapshot(p_store_id uuid, p_date date, p_employee_id uuid)
 RETURNS TABLE(id uuid, store_id uuid, date date, opening_balance numeric, closing_balance numeric, total_deposits numeric, total_withdrawals numeric, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_balance_data RECORD;
  v_snapshot_id uuid;
BEGIN
  SELECT * INTO v_balance_data
  FROM public.get_safe_balance_for_date(p_store_id, p_date);

  INSERT INTO public.safe_balance_history (
    store_id,
    date,
    opening_balance,
    closing_balance,
    total_deposits,
    total_withdrawals,
    created_by_id,
    updated_by_id
  )
  VALUES (
    p_store_id,
    p_date,
    v_balance_data.opening_balance,
    v_balance_data.closing_balance,
    v_balance_data.total_deposits,
    v_balance_data.total_withdrawals,
    p_employee_id,
    p_employee_id
  )
  ON CONFLICT (store_id, date)
  DO UPDATE SET
    opening_balance = EXCLUDED.opening_balance,
    closing_balance = EXCLUDED.closing_balance,
    total_deposits = EXCLUDED.total_deposits,
    total_withdrawals = EXCLUDED.total_withdrawals,
    updated_by_id = EXCLUDED.updated_by_id,
    updated_at = now()
  RETURNING safe_balance_history.id INTO v_snapshot_id;

  RETURN QUERY
  SELECT
    sbh.id,
    sbh.store_id,
    sbh.date,
    sbh.opening_balance,
    sbh.closing_balance,
    sbh.total_deposits,
    sbh.total_withdrawals,
    sbh.created_at,
    sbh.updated_at
  FROM public.safe_balance_history sbh
  WHERE sbh.id = v_snapshot_id;
END;
$function$
;


  create policy "Allow insert end_of_day_records"
  on "public"."end_of_day_records"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow read end_of_day_records"
  on "public"."end_of_day_records"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Allow update end_of_day_records"
  on "public"."end_of_day_records"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



