drop trigger if exists "update_ticket_reopen_requests_updated_at" on "public"."ticket_reopen_requests";

drop policy "Allow authenticated to create ticket reopen requests" on "public"."ticket_reopen_requests";

drop policy "Allow authenticated to update ticket reopen requests" on "public"."ticket_reopen_requests";

drop policy "Allow authenticated to view ticket reopen requests" on "public"."ticket_reopen_requests";

revoke delete on table "public"."ticket_reopen_requests" from "anon";

revoke insert on table "public"."ticket_reopen_requests" from "anon";

revoke references on table "public"."ticket_reopen_requests" from "anon";

revoke select on table "public"."ticket_reopen_requests" from "anon";

revoke trigger on table "public"."ticket_reopen_requests" from "anon";

revoke truncate on table "public"."ticket_reopen_requests" from "anon";

revoke update on table "public"."ticket_reopen_requests" from "anon";

revoke delete on table "public"."ticket_reopen_requests" from "authenticated";

revoke insert on table "public"."ticket_reopen_requests" from "authenticated";

revoke references on table "public"."ticket_reopen_requests" from "authenticated";

revoke select on table "public"."ticket_reopen_requests" from "authenticated";

revoke trigger on table "public"."ticket_reopen_requests" from "authenticated";

revoke truncate on table "public"."ticket_reopen_requests" from "authenticated";

revoke update on table "public"."ticket_reopen_requests" from "authenticated";

revoke delete on table "public"."ticket_reopen_requests" from "service_role";

revoke insert on table "public"."ticket_reopen_requests" from "service_role";

revoke references on table "public"."ticket_reopen_requests" from "service_role";

revoke select on table "public"."ticket_reopen_requests" from "service_role";

revoke trigger on table "public"."ticket_reopen_requests" from "service_role";

revoke truncate on table "public"."ticket_reopen_requests" from "service_role";

revoke update on table "public"."ticket_reopen_requests" from "service_role";

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_created_by_employee_id_fkey";

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_reviewed_by_employee_id_fkey";

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_status_check";

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_store_id_fkey";

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_ticket_id_fkey";

drop function if exists "public"."approve_ticket_reopen_request"(p_request_id uuid, p_reviewer_employee_id uuid, p_review_comment text);

drop function if exists "public"."create_ticket_reopen_request"(p_ticket_id uuid, p_reason_comment text, p_requested_changes_description text, p_created_by_employee_id uuid);

drop function if exists "public"."get_pending_ticket_reopen_requests"(p_store_id uuid);

drop function if exists "public"."get_pending_ticket_reopen_requests_count"(p_store_id uuid);

drop function if exists "public"."has_pending_ticket_reopen_request"(p_ticket_id uuid);

drop function if exists "public"."reject_ticket_reopen_request"(p_request_id uuid, p_reviewer_employee_id uuid, p_review_comment text);

drop function if exists "public"."update_ticket_reopen_requests_updated_at"();

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_pkey";

drop index if exists "public"."idx_ticket_reopen_requests_created_by";

drop index if exists "public"."idx_ticket_reopen_requests_status";

drop index if exists "public"."idx_ticket_reopen_requests_store";

drop index if exists "public"."idx_ticket_reopen_requests_ticket";

drop index if exists "public"."idx_ticket_reopen_requests_unique_pending";

drop index if exists "public"."ticket_reopen_requests_pkey";

drop table "public"."ticket_reopen_requests";


