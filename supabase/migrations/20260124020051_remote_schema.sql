create extension if not exists "pg_cron" with schema "pg_catalog";

drop extension if exists "pg_net";

create type "public"."role_permission_type" as enum ('Admin', 'Receptionist', 'Technician', 'Supervisor', 'Owner', 'Cashier');

drop trigger if exists "trigger_app_settings_updated_at" on "public"."app_settings";

drop trigger if exists "trigger_log_app_settings_change" on "public"."app_settings";

drop trigger if exists "trigger_update_inventory_on_approval" on "public"."inventory_transactions";

drop policy "Allow all access to app_settings" on "public"."app_settings";

drop policy "Allow all access to app_settings_audit" on "public"."app_settings_audit";

drop policy "Allow all access to attendance_change_proposals" on "public"."attendance_change_proposals";

drop policy "Allow all access to attendance_comments" on "public"."attendance_comments";

drop policy "Allow all access to cash_transaction_change_proposals" on "public"."cash_transaction_change_proposals";

drop policy "Allow all access to cash_transaction_edit_history" on "public"."cash_transaction_edit_history";

drop policy "Allow all access to cash_transactions" on "public"."cash_transactions";

drop policy "Allow all access to employee_inventory" on "public"."employee_inventory";

drop policy "Allow all access to employee_inventory_lots" on "public"."employee_inventory_lots";

drop policy "Allow all access to employee_services" on "public"."employee_services";

drop policy "Allow view employee stores" on "public"."employee_stores";

drop policy "Allow all access to inventory_distributions" on "public"."inventory_distributions";

drop policy "Allow all access to inventory_items" on "public"."inventory_items";

drop policy "Allow all access to inventory_purchase_lots" on "public"."inventory_purchase_lots";

drop policy "Allow all access to inventory_transaction_items" on "public"."inventory_transaction_items";

drop policy "Allow all access to inventory_transactions" on "public"."inventory_transactions";

drop policy "Allow all access to permission_definitions" on "public"."permission_definitions";

drop policy "Allow all access to queue_removals_log" on "public"."queue_removals_log";

drop policy "Allow all access to queue_violation_actions" on "public"."queue_violation_actions";

drop policy "Allow all access to queue_violation_reports" on "public"."queue_violation_reports";

drop policy "Allow all access to queue_violation_responses" on "public"."queue_violation_responses";

drop policy "Allow all access to role_permissions" on "public"."role_permissions";

drop policy "Allow all access to role_permissions_audit" on "public"."role_permissions_audit";

drop policy "Allow all access to safe_balance_history" on "public"."safe_balance_history";

drop policy "Allow all access to services" on "public"."services";

drop policy "Allow all access to store_product_preferences" on "public"."store_product_preferences";

drop policy "Allow all access to store_service_categories" on "public"."store_service_categories";

drop policy "Allow all access to store_services" on "public"."store_services";

drop policy "Users can view active stores" on "public"."stores";

drop policy "Allow all access to ticket_activity_log" on "public"."ticket_activity_log";

drop policy "Allow all access to ticket_reopen_requests" on "public"."ticket_reopen_requests";

drop policy "Allow all access to attendance_records" on "public"."attendance_records";

drop policy "Allow all access to clients" on "public"."clients";

drop policy "Allow all access to employees" on "public"."employees";

drop policy "Allow all access to sale_tickets" on "public"."sale_tickets";

drop policy "Admins can manage stores" on "public"."stores";

drop policy "Allow all access to technician_ready_queue" on "public"."technician_ready_queue";

drop policy "Allow all access to ticket_items" on "public"."ticket_items";

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

alter table "public"."employee_inventory" drop constraint "employee_inventory_item_id_fkey";

alter table "public"."employee_inventory_lots" drop constraint "employee_inventory_lots_item_id_fkey";

alter table "public"."inventory_distributions" drop constraint "inventory_distributions_from_type_check";

alter table "public"."inventory_distributions" drop constraint "inventory_distributions_item_id_fkey";

alter table "public"."inventory_distributions" drop constraint "inventory_distributions_status_check";

alter table "public"."inventory_items" drop constraint "inventory_items_master_no_parent";

alter table "public"."inventory_items" drop constraint "inventory_items_parent_id_fkey";

alter table "public"."inventory_items" drop constraint "inventory_items_store_id_fkey";

alter table "public"."inventory_purchase_lots" drop constraint "inventory_purchase_lots_item_id_fkey";

alter table "public"."inventory_transaction_items" drop constraint "inventory_transaction_items_item_id_fkey";

alter table "public"."store_product_preferences" drop constraint "store_product_preferences_item_id_fkey";

alter table "public"."store_product_preferences" drop constraint "store_product_preferences_unique";

alter table "public"."ticket_items" drop constraint "discount_amount_non_negative";

alter table "public"."ticket_items" drop constraint "discount_percentage_range";

alter table "public"."ticket_items" drop constraint "ticket_items_service_id_fkey";

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_created_by_employee_id_fkey";

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_reviewed_by_employee_id_fkey";

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_status_check";

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_store_id_fkey";

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_ticket_id_fkey";

alter table "public"."employee_inventory" drop constraint "employee_inventory_unique_employee_item";

alter table "public"."employees" drop constraint "employees_pay_type_valid";

alter table "public"."employees" drop constraint "employees_role_valid";

alter table "public"."inventory_distributions" drop constraint "inventory_distributions_to_employee_id_fkey";

alter table "public"."store_services" drop constraint "store_services_service_id_fkey";

alter table "public"."ticket_items" drop constraint "ticket_items_store_service_id_fkey";

drop function if exists "public"."calculate_weighted_average_cost"(p_store_id uuid, p_item_id uuid);

drop function if exists "public"."consume_employee_inventory"(p_employee_id uuid, p_item_id uuid, p_quantity numeric, p_notes text);

drop function if exists "public"."generate_inventory_transaction_number"(p_transaction_type text, p_store_id uuid);

drop function if exists "public"."generate_lot_number"(p_store_id uuid, p_supplier_code text, p_offset integer);

drop function if exists "public"."get_available_lots_fifo"(p_store_id uuid, p_item_id uuid);

drop function if exists "public"."get_master_item_total_quantity"(p_master_item_id uuid, p_store_id uuid);

drop function if exists "public"."get_pending_approvals_for_technician"(p_employee_id uuid, p_store_id uuid);

drop function if exists "public"."get_services_by_popularity"(p_store_id uuid);

drop function if exists "public"."get_sub_items"(p_master_item_id uuid);

drop function if exists "public"."initialize_store_settings"(p_store_id uuid);

drop function if exists "public"."log_app_settings_change"();

drop function if exists "public"."master_item_has_low_stock"(p_master_item_id uuid, p_store_id uuid);

drop function if exists "public"."refresh_employee_inventory_summary"(p_employee_id uuid, p_item_id uuid);

drop function if exists "public"."return_from_employee"(p_employee_id uuid, p_item_id uuid, p_quantity numeric, p_returned_by_id uuid, p_notes text);

drop function if exists "public"."update_app_settings_updated_at"();

alter table "public"."inventory_items" drop constraint "inventory_items_pkey";

alter table "public"."ticket_reopen_requests" drop constraint "ticket_reopen_requests_pkey";

drop index if exists "public"."idx_app_settings_audit_changed_at";

drop index if exists "public"."idx_app_settings_audit_store";

drop index if exists "public"."idx_app_settings_key";

drop index if exists "public"."idx_attendance_change_proposals_record";

drop index if exists "public"."idx_cash_transactions_approved_by";

drop index if exists "public"."idx_cash_transactions_created_by";

drop index if exists "public"."idx_cash_transactions_date";

drop index if exists "public"."idx_cash_transactions_status";

drop index if exists "public"."idx_cash_transactions_store_id";

drop index if exists "public"."idx_cash_transactions_type";

drop index if exists "public"."idx_employee_inventory_employee_id";

drop index if exists "public"."idx_employee_inventory_item_id";

drop index if exists "public"."idx_employee_inventory_lots_employee_id";

drop index if exists "public"."idx_employee_inventory_lots_item_id";

drop index if exists "public"."idx_employee_inventory_lots_lot_id";

drop index if exists "public"."idx_employee_inventory_store_id";

drop index if exists "public"."idx_employees_status";

drop index if exists "public"."idx_inventory_distributions_date";

drop index if exists "public"."idx_inventory_distributions_item_id";

drop index if exists "public"."idx_inventory_distributions_lot_id";

drop index if exists "public"."idx_inventory_distributions_store_id";

drop index if exists "public"."idx_inventory_distributions_to_employee";

drop index if exists "public"."idx_inventory_items_active";

drop index if exists "public"."idx_inventory_items_category";

drop index if exists "public"."idx_inventory_items_is_master";

drop index if exists "public"."idx_inventory_items_name";

drop index if exists "public"."idx_inventory_items_parent_id";

drop index if exists "public"."idx_inventory_items_store_id";

drop index if exists "public"."idx_inventory_purchase_lots_expiration_date";

drop index if exists "public"."idx_inventory_purchase_lots_item_id";

drop index if exists "public"."idx_inventory_purchase_lots_purchase_date";

drop index if exists "public"."idx_inventory_purchase_lots_status";

drop index if exists "public"."idx_inventory_purchase_lots_store_id";

drop index if exists "public"."idx_inventory_transaction_items_lot_id";

drop index if exists "public"."idx_inventory_transaction_items_transaction";

drop index if exists "public"."idx_permission_definitions_key";

drop index if exists "public"."idx_permission_definitions_module";

drop index if exists "public"."idx_services_active";

drop index if exists "public"."idx_services_category";

drop index if exists "public"."idx_services_code";

drop index if exists "public"."idx_store_product_preferences_item_id";

drop index if exists "public"."idx_store_product_preferences_store_id";

drop index if exists "public"."idx_store_services_active";

drop index if exists "public"."idx_store_services_category";

drop index if exists "public"."idx_store_services_code";

drop index if exists "public"."idx_stores_active";

drop index if exists "public"."idx_stores_code";

drop index if exists "public"."idx_ticket_activity_log_created_at";

drop index if exists "public"."idx_ticket_activity_log_ticket_id";

drop index if exists "public"."idx_ticket_items_completed_at";

drop index if exists "public"."idx_ticket_items_service_id";

drop index if exists "public"."idx_ticket_items_started_at";

drop index if exists "public"."idx_ticket_reopen_requests_status";

drop index if exists "public"."idx_ticket_reopen_requests_store";

drop index if exists "public"."idx_ticket_reopen_requests_ticket";

drop index if exists "public"."inventory_items_pkey";

drop index if exists "public"."store_product_preferences_unique";

drop index if exists "public"."ticket_reopen_requests_pkey";

drop index if exists "public"."employee_inventory_unique_employee_item";

drop index if exists "public"."idx_employee_inventory_lots_employee_item";

drop index if exists "public"."idx_inventory_purchase_lots_store_item_status";

drop table "public"."ticket_reopen_requests";


  create table "public"."app_versions" (
    "id" uuid not null default gen_random_uuid(),
    "version_number" text not null,
    "build_hash" text not null,
    "deployed_at" timestamp with time zone default now(),
    "release_notes" text,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."app_versions" enable row level security;


  create table "public"."approval_status_correction_audit" (
    "id" uuid not null default gen_random_uuid(),
    "ticket_id" uuid not null,
    "ticket_no" text not null,
    "original_approval_status" text not null,
    "new_approval_status" text not null,
    "closed_at" timestamp with time zone,
    "approval_deadline" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by" uuid,
    "hours_after_deadline" numeric,
    "correction_reason" text,
    "correction_timestamp" timestamp with time zone default now()
      );


alter table "public"."approval_status_correction_audit" enable row level security;


  create table "public"."auto_approval_runs" (
    "id" uuid not null default gen_random_uuid(),
    "executed_at" timestamp with time zone not null default now(),
    "tickets_approved" integer not null default 0,
    "stores_processed" uuid[] default ARRAY[]::uuid[],
    "result" jsonb,
    "source" text not null default 'unknown'::text,
    "duration_ms" integer,
    "error_message" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."auto_approval_runs" enable row level security;


  create table "public"."client_color_history" (
    "id" uuid not null default gen_random_uuid(),
    "client_id" uuid not null,
    "ticket_id" uuid,
    "color" text not null,
    "service_type" text,
    "applied_date" timestamp with time zone default now(),
    "created_at" timestamp with time zone default now()
      );


alter table "public"."client_color_history" enable row level security;


  create table "public"."end_of_day_records" (
    "id" uuid not null default gen_random_uuid(),
    "store_id" uuid not null,
    "date" date not null,
    "opening_cash_amount" numeric(10,2) default 0,
    "bill_100" integer default 0,
    "bill_50" integer default 0,
    "bill_20" integer default 0,
    "bill_10" integer default 0,
    "bill_5" integer default 0,
    "bill_2" integer default 0,
    "bill_1" integer default 0,
    "coin_25" integer default 0,
    "coin_10" integer default 0,
    "coin_5" integer default 0,
    "closing_cash_amount" numeric(10,2) default 0,
    "closing_bill_100" integer default 0,
    "closing_bill_50" integer default 0,
    "closing_bill_20" integer default 0,
    "closing_bill_10" integer default 0,
    "closing_bill_5" integer default 0,
    "closing_bill_2" integer default 0,
    "closing_bill_1" integer default 0,
    "closing_coin_25" integer default 0,
    "closing_coin_10" integer default 0,
    "closing_coin_5" integer default 0,
    "notes" text,
    "created_by" uuid,
    "updated_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."end_of_day_records" enable row level security;


  create table "public"."function_error_logs" (
    "id" uuid not null default gen_random_uuid(),
    "function_name" text not null,
    "error_message" text not null,
    "error_detail" text,
    "error_hint" text,
    "parameters" jsonb,
    "store_id" uuid,
    "occurred_at" timestamp with time zone not null default now(),
    "context" text
      );


alter table "public"."function_error_logs" enable row level security;


  create table "public"."inventory_approval_audit_log" (
    "id" uuid not null default gen_random_uuid(),
    "employee_id" uuid not null,
    "transaction_id" uuid not null,
    "store_id" uuid not null,
    "action_attempted" text not null,
    "transaction_type" text not null,
    "transaction_number" text not null,
    "blocked_reason" text not null default 'Self-approval not allowed'::text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."inventory_approval_audit_log" enable row level security;


  create table "public"."inventory_audit_items" (
    "id" uuid not null default gen_random_uuid(),
    "audit_id" uuid not null,
    "master_item_id" uuid not null,
    "expected_quantity" numeric(10,2) not null default 0,
    "actual_quantity" numeric(10,2) not null default 0,
    "variance" numeric(10,2) generated always as ((actual_quantity - expected_quantity)) stored,
    "variance_value" numeric(10,2) not null default 0,
    "unit_cost" numeric(10,2) not null default 0,
    "notes" text default ''::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."inventory_audit_items" enable row level security;


  create table "public"."inventory_audits" (
    "id" uuid not null default gen_random_uuid(),
    "audit_number" text not null,
    "store_id" uuid not null,
    "audit_type" text not null,
    "employee_id" uuid,
    "audit_date" timestamp with time zone not null default now(),
    "audited_by_id" uuid not null,
    "status" text not null default 'scheduled'::text,
    "total_variance_value" numeric(10,2) default 0,
    "notes" text default ''::text,
    "approved_by_id" uuid,
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."inventory_audits" enable row level security;


  create table "public"."store_product_purchase_units" (
    "id" uuid not null default gen_random_uuid(),
    "store_id" uuid not null,
    "master_item_id" uuid not null,
    "unit_name" text not null,
    "multiplier" numeric(10,2) not null,
    "is_default" boolean not null default false,
    "display_order" integer not null default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."store_product_purchase_units" enable row level security;

alter table "public"."app_settings" add column "updated_by" uuid;

alter table "public"."app_settings" alter column "description" set default ''::text;

alter table "public"."app_settings_audit" drop column "changed_at";

alter table "public"."app_settings_audit" add column "created_at" timestamp with time zone default now();

alter table "public"."employee_inventory" drop column "item_id";

alter table "public"."employee_inventory" add column "master_item_id" uuid not null;

alter table "public"."employee_inventory_lots" drop column "item_id";

alter table "public"."employee_inventory_lots" add column "master_item_id" uuid not null;

alter table "public"."employees" add column "payout_commission_pct" numeric;

alter table "public"."employees" add column "payout_flat_per_service" numeric;

alter table "public"."employees" add column "payout_hourly_rate" numeric;

alter table "public"."employees" add column "payout_rule_type" text;

alter table "public"."employees" alter column "pay_type" set default 'hourly'::text;

alter table "public"."employees" alter column "role" drop not null;

alter table "public"."employees" alter column "weekly_schedule" set default '{"friday": true, "monday": true, "sunday": true, "tuesday": true, "saturday": true, "thursday": true, "wednesday": true}'::jsonb;

alter table "public"."inventory_distributions" drop column "item_id";

alter table "public"."inventory_distributions" add column "acknowledged_at" timestamp with time zone;

alter table "public"."inventory_distributions" add column "acknowledged_by_signature" text;

alter table "public"."inventory_distributions" add column "actual_return_date" timestamp with time zone;

alter table "public"."inventory_distributions" add column "expected_return_date" timestamp with time zone;

alter table "public"."inventory_distributions" add column "master_item_id" uuid not null;

alter table "public"."inventory_distributions" alter column "distributed_by_id" set not null;

alter table "public"."inventory_distributions" alter column "from_type" drop default;

alter table "public"."inventory_distributions" alter column "lot_id" set not null;

alter table "public"."inventory_distributions" alter column "to_employee_id" set not null;

alter table "public"."inventory_distributions" alter column "unit_cost" drop default;

alter table "public"."inventory_items" drop column "color_code";

alter table "public"."inventory_items" drop column "is_master_item";

alter table "public"."inventory_items" drop column "parent_id";

alter table "public"."inventory_items" drop column "size";

alter table "public"."inventory_purchase_lots" drop column "item_id";

alter table "public"."inventory_purchase_lots" add column "master_item_id" uuid not null;

alter table "public"."inventory_transaction_items" add column "master_item_id" uuid;

alter table "public"."sale_tickets" add column "discount" numeric(10,2) default 0.00;

alter table "public"."sale_tickets" add column "opened_by_role" text;

alter table "public"."sale_tickets" add column "reviewed_by_receptionist" boolean default false;

alter table "public"."sale_tickets" add column "todays_color" text default ''::text;

alter table "public"."services" add column "archived" boolean not null default false;

alter table "public"."store_product_preferences" drop column "item_id";

alter table "public"."store_product_preferences" add column "master_item_id" uuid not null;

alter table "public"."store_product_preferences" alter column "last_purchase_cost" set default 0;

alter table "public"."store_services" alter column "active" set not null;

alter table "public"."store_services" alter column "archived" set not null;

alter table "public"."store_services" alter column "created_at" set not null;

alter table "public"."store_services" alter column "service_id" set not null;

alter table "public"."store_services" alter column "updated_at" set not null;

alter table "public"."stores" add column "opening_hours" jsonb;

alter table "public"."stores" add column "opening_time" time without time zone default '10:00:00'::time without time zone;

alter table "public"."stores" alter column "is_headquarters" set not null;

CREATE UNIQUE INDEX app_versions_pkey ON public.app_versions USING btree (id);

CREATE UNIQUE INDEX approval_status_correction_audit_pkey ON public.approval_status_correction_audit USING btree (id);

CREATE UNIQUE INDEX approval_status_correction_audit_ticket_id_key ON public.approval_status_correction_audit USING btree (ticket_id);

CREATE UNIQUE INDEX auto_approval_runs_pkey ON public.auto_approval_runs USING btree (id);

CREATE UNIQUE INDEX client_color_history_pkey ON public.client_color_history USING btree (id);

CREATE UNIQUE INDEX end_of_day_records_pkey ON public.end_of_day_records USING btree (id);

CREATE UNIQUE INDEX end_of_day_records_store_date_unique ON public.end_of_day_records USING btree (store_id, date);

CREATE UNIQUE INDEX function_error_logs_pkey ON public.function_error_logs USING btree (id);

CREATE INDEX idx_app_settings_audit_created_at ON public.app_settings_audit USING btree (created_at);

CREATE INDEX idx_app_settings_audit_store_id ON public.app_settings_audit USING btree (store_id);

CREATE INDEX idx_app_settings_critical ON public.app_settings USING btree (store_id, is_critical) WHERE (is_critical = true);

CREATE INDEX idx_app_settings_dependencies ON public.app_settings USING gin (dependencies);

CREATE INDEX idx_approval_correction_audit_ticket_id ON public.approval_status_correction_audit USING btree (ticket_id);

CREATE INDEX idx_approval_status_correction_audit_approved_by ON public.approval_status_correction_audit USING btree (approved_by);

CREATE INDEX idx_attendance_change_proposals_attendance_record ON public.attendance_change_proposals USING btree (attendance_record_id);

CREATE INDEX idx_attendance_change_proposals_reviewed_by ON public.attendance_change_proposals USING btree (reviewed_by_employee_id);

CREATE INDEX idx_attendance_records_employee_date ON public.attendance_records USING btree (employee_id, work_date);

CREATE INDEX idx_attendance_records_employee_status ON public.attendance_records USING btree (employee_id, status) WHERE ((status = 'checked_in'::text) AND (check_out_time IS NULL));

CREATE INDEX idx_auto_approval_runs_executed_at ON public.auto_approval_runs USING btree (executed_at DESC);

CREATE INDEX idx_cash_transactions_created_by_id_fk ON public.cash_transactions USING btree (created_by_id);

CREATE INDEX idx_cash_transactions_manager_approved_by_id_fk ON public.cash_transactions USING btree (manager_approved_by_id);

CREATE INDEX idx_client_color_history_applied_date ON public.client_color_history USING btree (applied_date DESC);

CREATE INDEX idx_client_color_history_client_id ON public.client_color_history USING btree (client_id);

CREATE INDEX idx_clients_store_phone ON public.clients USING btree (store_id, phone_number);

CREATE INDEX idx_employee_inventory_lots_employee_id_fk ON public.employee_inventory_lots USING btree (employee_id);

CREATE INDEX idx_employee_inventory_lots_lot_id_fk ON public.employee_inventory_lots USING btree (lot_id);

CREATE INDEX idx_employee_inventory_lots_master_item_id ON public.employee_inventory_lots USING btree (master_item_id);

CREATE INDEX idx_employee_inventory_lots_store_id_fk ON public.employee_inventory_lots USING btree (store_id);

CREATE INDEX idx_employee_inventory_master_item_id ON public.employee_inventory USING btree (master_item_id);

CREATE INDEX idx_employees_pay_type ON public.employees USING btree (pay_type);

CREATE INDEX idx_end_of_day_records_date ON public.end_of_day_records USING btree (date);

CREATE INDEX idx_end_of_day_records_store_date ON public.end_of_day_records USING btree (store_id, date);

CREATE INDEX idx_end_of_day_records_store_id ON public.end_of_day_records USING btree (store_id);

CREATE INDEX idx_function_errors_function_name ON public.function_error_logs USING btree (function_name, occurred_at DESC);

CREATE INDEX idx_function_errors_occurred_at ON public.function_error_logs USING btree (occurred_at DESC);

CREATE INDEX idx_function_errors_store_id ON public.function_error_logs USING btree (store_id, occurred_at DESC);

CREATE INDEX idx_inventory_approval_audit_log_employee_id_fk ON public.inventory_approval_audit_log USING btree (employee_id);

CREATE INDEX idx_inventory_approval_audit_log_store_id_fk ON public.inventory_approval_audit_log USING btree (store_id);

CREATE INDEX idx_inventory_approval_audit_log_transaction_id_fk ON public.inventory_approval_audit_log USING btree (transaction_id);

CREATE INDEX idx_inventory_audit_items_audit_id_fk ON public.inventory_audit_items USING btree (audit_id);

CREATE INDEX idx_inventory_audit_items_master_item_id ON public.inventory_audit_items USING btree (master_item_id);

CREATE INDEX idx_inventory_audits_approved_by_id_fk ON public.inventory_audits USING btree (approved_by_id);

CREATE INDEX idx_inventory_audits_audited_by_id_fk ON public.inventory_audits USING btree (audited_by_id);

CREATE INDEX idx_inventory_audits_employee_id_fk ON public.inventory_audits USING btree (employee_id);

CREATE INDEX idx_inventory_audits_store_id ON public.inventory_audits USING btree (store_id);

CREATE INDEX idx_inventory_distributions_distributed_by_id_fk ON public.inventory_distributions USING btree (distributed_by_id);

CREATE INDEX idx_inventory_distributions_from_employee_id_fk ON public.inventory_distributions USING btree (from_employee_id);

CREATE INDEX idx_inventory_distributions_lot_id_fk ON public.inventory_distributions USING btree (lot_id);

CREATE INDEX idx_inventory_distributions_master_item_id ON public.inventory_distributions USING btree (master_item_id);

CREATE INDEX idx_inventory_distributions_store_id_fk ON public.inventory_distributions USING btree (store_id);

CREATE INDEX idx_inventory_distributions_to_employee_id_fk ON public.inventory_distributions USING btree (to_employee_id);

CREATE INDEX idx_inventory_purchase_lots_created_by_id_fk ON public.inventory_purchase_lots USING btree (created_by_id);

CREATE INDEX idx_inventory_purchase_lots_master_item_id ON public.inventory_purchase_lots USING btree (master_item_id);

CREATE INDEX idx_inventory_purchase_lots_store_id_fk ON public.inventory_purchase_lots USING btree (store_id);

CREATE INDEX idx_inventory_transaction_items_item_id_fk ON public.inventory_transaction_items USING btree (item_id);

CREATE INDEX idx_inventory_transaction_items_lot_id_fk ON public.inventory_transaction_items USING btree (lot_id);

CREATE INDEX idx_inventory_transaction_items_purchase_unit_id ON public.inventory_transaction_items USING btree (purchase_unit_id);

CREATE INDEX idx_inventory_transaction_items_transaction_id ON public.inventory_transaction_items USING btree (transaction_id);

CREATE INDEX idx_inventory_transactions_manager_approved_by_id_fk ON public.inventory_transactions USING btree (manager_approved_by_id);

CREATE INDEX idx_inventory_transactions_recipient_approved_by_id_fk ON public.inventory_transactions USING btree (recipient_approved_by_id);

CREATE INDEX idx_inventory_transactions_requested_by_id_fk ON public.inventory_transactions USING btree (requested_by_id);

CREATE INDEX idx_queue_removals_removed_at ON public.queue_removals_log USING btree (removed_at DESC);

CREATE INDEX idx_sale_tickets_approval_level_status ON public.sale_tickets USING btree (approval_required_level, approval_status) WHERE (approval_status = 'pending_approval'::text);

CREATE INDEX idx_sale_tickets_approval_performer ON public.sale_tickets USING btree (approval_performer_id) WHERE (approval_status = 'pending_approval'::text);

CREATE INDEX idx_sale_tickets_approval_required_level ON public.sale_tickets USING btree (approval_required_level);

CREATE INDEX idx_sale_tickets_approval_status_deadline ON public.sale_tickets USING btree (approval_status, approval_deadline) WHERE (approval_status = 'pending_approval'::text);

CREATE INDEX idx_sale_tickets_completed_by ON public.sale_tickets USING btree (completed_by);

CREATE INDEX idx_sale_tickets_date_store ON public.sale_tickets USING btree (ticket_date, store_id);

CREATE INDEX idx_sale_tickets_store_date_closed ON public.sale_tickets USING btree (store_id, ticket_date, closed_at) WHERE (closed_at IS NULL);

CREATE INDEX idx_store_product_preferences_last_used_purchase_unit_id_fk ON public.store_product_preferences USING btree (last_used_purchase_unit_id);

CREATE INDEX idx_store_product_preferences_master_item_id ON public.store_product_preferences USING btree (master_item_id);

CREATE INDEX idx_store_product_preferences_store_item ON public.store_product_preferences USING btree (store_id, master_item_id);

CREATE INDEX idx_store_product_preferences_updated_by_id_fk ON public.store_product_preferences USING btree (updated_by_id);

CREATE INDEX idx_store_product_purchase_units_default ON public.store_product_purchase_units USING btree (store_id, master_item_id, is_default) WHERE (is_default = true);

CREATE INDEX idx_store_product_purchase_units_master_item_id ON public.store_product_purchase_units USING btree (master_item_id);

CREATE INDEX idx_store_product_purchase_units_store_item ON public.store_product_purchase_units USING btree (store_id, master_item_id);

CREATE INDEX idx_stores_is_headquarters ON public.stores USING btree (is_headquarters) WHERE (is_headquarters = true);

CREATE INDEX idx_technician_ready_queue_current_open_ticket_id ON public.technician_ready_queue USING btree (current_open_ticket_id);

CREATE INDEX idx_ticket_activity_log_employee_id ON public.ticket_activity_log USING btree (employee_id);

CREATE INDEX idx_ticket_items_completed_by_fk ON public.ticket_items USING btree (completed_by);

CREATE INDEX idx_ticket_items_employee_ticket ON public.ticket_items USING btree (employee_id, sale_ticket_id);

CREATE INDEX idx_ticket_items_ticket_employee ON public.ticket_items USING btree (sale_ticket_id, employee_id);

CREATE INDEX idx_ticket_items_timer_stopped_at ON public.ticket_items USING btree (timer_stopped_at);

CREATE UNIQUE INDEX inventory_approval_audit_log_pkey ON public.inventory_approval_audit_log USING btree (id);

CREATE UNIQUE INDEX inventory_audit_items_pkey ON public.inventory_audit_items USING btree (id);

CREATE UNIQUE INDEX inventory_audits_audit_number_key ON public.inventory_audits USING btree (audit_number);

CREATE UNIQUE INDEX inventory_audits_pkey ON public.inventory_audits USING btree (id);

CREATE UNIQUE INDEX inventory_items_pkey1 ON public.inventory_items USING btree (id);

CREATE UNIQUE INDEX store_product_preferences_unique_store_item ON public.store_product_preferences USING btree (store_id, master_item_id);

CREATE UNIQUE INDEX store_product_purchase_units_pkey ON public.store_product_purchase_units USING btree (id);

CREATE UNIQUE INDEX store_product_purchase_units_unique_name ON public.store_product_purchase_units USING btree (store_id, master_item_id, unit_name);

CREATE INDEX ticket_activity_log_created_at_idx ON public.ticket_activity_log USING btree (created_at DESC);

CREATE INDEX ticket_activity_log_ticket_id_idx ON public.ticket_activity_log USING btree (ticket_id);

CREATE UNIQUE INDEX employee_inventory_unique_employee_item ON public.employee_inventory USING btree (employee_id, master_item_id);

CREATE INDEX idx_employee_inventory_lots_employee_item ON public.employee_inventory_lots USING btree (employee_id, master_item_id);

CREATE INDEX idx_inventory_purchase_lots_store_item_status ON public.inventory_purchase_lots USING btree (store_id, master_item_id, status);

alter table "public"."app_versions" add constraint "app_versions_pkey" PRIMARY KEY using index "app_versions_pkey";

alter table "public"."approval_status_correction_audit" add constraint "approval_status_correction_audit_pkey" PRIMARY KEY using index "approval_status_correction_audit_pkey";

alter table "public"."auto_approval_runs" add constraint "auto_approval_runs_pkey" PRIMARY KEY using index "auto_approval_runs_pkey";

alter table "public"."client_color_history" add constraint "client_color_history_pkey" PRIMARY KEY using index "client_color_history_pkey";

alter table "public"."end_of_day_records" add constraint "end_of_day_records_pkey" PRIMARY KEY using index "end_of_day_records_pkey";

alter table "public"."function_error_logs" add constraint "function_error_logs_pkey" PRIMARY KEY using index "function_error_logs_pkey";

alter table "public"."inventory_approval_audit_log" add constraint "inventory_approval_audit_log_pkey" PRIMARY KEY using index "inventory_approval_audit_log_pkey";

alter table "public"."inventory_audit_items" add constraint "inventory_audit_items_pkey" PRIMARY KEY using index "inventory_audit_items_pkey";

alter table "public"."inventory_audits" add constraint "inventory_audits_pkey" PRIMARY KEY using index "inventory_audits_pkey";

alter table "public"."inventory_items" add constraint "inventory_items_pkey1" PRIMARY KEY using index "inventory_items_pkey1";

alter table "public"."store_product_purchase_units" add constraint "store_product_purchase_units_pkey" PRIMARY KEY using index "store_product_purchase_units_pkey";

alter table "public"."app_settings" add constraint "app_settings_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.employees(id) not valid;

alter table "public"."app_settings" validate constraint "app_settings_updated_by_fkey";

alter table "public"."app_settings" add constraint "check_default_value_is_primitive" CHECK ((jsonb_typeof(default_value) = ANY (ARRAY['boolean'::text, 'number'::text, 'string'::text, 'null'::text]))) not valid;

alter table "public"."app_settings" validate constraint "check_default_value_is_primitive";

alter table "public"."app_settings" add constraint "check_setting_value_is_primitive" CHECK ((jsonb_typeof(setting_value) = ANY (ARRAY['boolean'::text, 'number'::text, 'string'::text, 'null'::text]))) not valid;

alter table "public"."app_settings" validate constraint "check_setting_value_is_primitive";

alter table "public"."approval_status_correction_audit" add constraint "approval_status_correction_audit_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES public.employees(id) not valid;

alter table "public"."approval_status_correction_audit" validate constraint "approval_status_correction_audit_approved_by_fkey";

alter table "public"."approval_status_correction_audit" add constraint "approval_status_correction_audit_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.sale_tickets(id) ON DELETE CASCADE not valid;

alter table "public"."approval_status_correction_audit" validate constraint "approval_status_correction_audit_ticket_id_fkey";

alter table "public"."approval_status_correction_audit" add constraint "approval_status_correction_audit_ticket_id_key" UNIQUE using index "approval_status_correction_audit_ticket_id_key";

alter table "public"."client_color_history" add constraint "client_color_history_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE not valid;

alter table "public"."client_color_history" validate constraint "client_color_history_client_id_fkey";

alter table "public"."client_color_history" add constraint "client_color_history_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES public.sale_tickets(id) ON DELETE SET NULL not valid;

alter table "public"."client_color_history" validate constraint "client_color_history_ticket_id_fkey";

alter table "public"."employees" add constraint "employees_role_check" CHECK ((role <@ ARRAY['Admin'::text, 'Technician'::text, 'Receptionist'::text, 'Manager'::text, 'Owner'::text, 'Spa Expert'::text, 'Supervisor'::text, 'Cashier'::text])) not valid;

alter table "public"."employees" validate constraint "employees_role_check";

alter table "public"."end_of_day_records" add constraint "end_of_day_records_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.employees(id) not valid;

alter table "public"."end_of_day_records" validate constraint "end_of_day_records_created_by_fkey";

alter table "public"."end_of_day_records" add constraint "end_of_day_records_store_date_unique" UNIQUE using index "end_of_day_records_store_date_unique";

alter table "public"."end_of_day_records" add constraint "end_of_day_records_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."end_of_day_records" validate constraint "end_of_day_records_store_id_fkey";

alter table "public"."end_of_day_records" add constraint "end_of_day_records_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.employees(id) not valid;

alter table "public"."end_of_day_records" validate constraint "end_of_day_records_updated_by_fkey";

alter table "public"."inventory_approval_audit_log" add constraint "inventory_approval_audit_log_action_attempted_check" CHECK ((action_attempted = ANY (ARRAY['approve'::text, 'reject'::text]))) not valid;

alter table "public"."inventory_approval_audit_log" validate constraint "inventory_approval_audit_log_action_attempted_check";

alter table "public"."inventory_approval_audit_log" add constraint "inventory_approval_audit_log_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_approval_audit_log" validate constraint "inventory_approval_audit_log_employee_id_fkey";

alter table "public"."inventory_approval_audit_log" add constraint "inventory_approval_audit_log_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_approval_audit_log" validate constraint "inventory_approval_audit_log_store_id_fkey";

alter table "public"."inventory_approval_audit_log" add constraint "inventory_approval_audit_log_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES public.inventory_transactions(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_approval_audit_log" validate constraint "inventory_approval_audit_log_transaction_id_fkey";

alter table "public"."inventory_approval_audit_log" add constraint "inventory_approval_audit_log_transaction_type_check" CHECK ((transaction_type = ANY (ARRAY['in'::text, 'out'::text]))) not valid;

alter table "public"."inventory_approval_audit_log" validate constraint "inventory_approval_audit_log_transaction_type_check";

alter table "public"."inventory_audit_items" add constraint "inventory_audit_items_actual_quantity_non_negative" CHECK ((actual_quantity >= (0)::numeric)) not valid;

alter table "public"."inventory_audit_items" validate constraint "inventory_audit_items_actual_quantity_non_negative";

alter table "public"."inventory_audit_items" add constraint "inventory_audit_items_audit_id_fkey" FOREIGN KEY (audit_id) REFERENCES public.inventory_audits(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_audit_items" validate constraint "inventory_audit_items_audit_id_fkey";

alter table "public"."inventory_audit_items" add constraint "inventory_audit_items_expected_quantity_non_negative" CHECK ((expected_quantity >= (0)::numeric)) not valid;

alter table "public"."inventory_audit_items" validate constraint "inventory_audit_items_expected_quantity_non_negative";

alter table "public"."inventory_audits" add constraint "inventory_audits_approved_by_id_fkey" FOREIGN KEY (approved_by_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_audits" validate constraint "inventory_audits_approved_by_id_fkey";

alter table "public"."inventory_audits" add constraint "inventory_audits_audit_number_key" UNIQUE using index "inventory_audits_audit_number_key";

alter table "public"."inventory_audits" add constraint "inventory_audits_audit_number_not_empty" CHECK ((audit_number <> ''::text)) not valid;

alter table "public"."inventory_audits" validate constraint "inventory_audits_audit_number_not_empty";

alter table "public"."inventory_audits" add constraint "inventory_audits_audit_type_valid" CHECK ((audit_type = ANY (ARRAY['full_store'::text, 'employee_specific'::text, 'spot_check'::text, 'cycle_count'::text]))) not valid;

alter table "public"."inventory_audits" validate constraint "inventory_audits_audit_type_valid";

alter table "public"."inventory_audits" add constraint "inventory_audits_audited_by_id_fkey" FOREIGN KEY (audited_by_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_audits" validate constraint "inventory_audits_audited_by_id_fkey";

alter table "public"."inventory_audits" add constraint "inventory_audits_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_audits" validate constraint "inventory_audits_employee_id_fkey";

alter table "public"."inventory_audits" add constraint "inventory_audits_status_valid" CHECK ((status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'approved'::text]))) not valid;

alter table "public"."inventory_audits" validate constraint "inventory_audits_status_valid";

alter table "public"."inventory_audits" add constraint "inventory_audits_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_audits" validate constraint "inventory_audits_store_id_fkey";

alter table "public"."inventory_distributions" add constraint "inventory_distributions_distribution_number_not_empty" CHECK ((distribution_number <> ''::text)) not valid;

alter table "public"."inventory_distributions" validate constraint "inventory_distributions_distribution_number_not_empty";

alter table "public"."inventory_distributions" add constraint "inventory_distributions_from_type_valid" CHECK ((from_type = ANY (ARRAY['store'::text, 'employee'::text]))) not valid;

alter table "public"."inventory_distributions" validate constraint "inventory_distributions_from_type_valid";

alter table "public"."inventory_distributions" add constraint "inventory_distributions_quantity_positive" CHECK ((quantity > (0)::numeric)) not valid;

alter table "public"."inventory_distributions" validate constraint "inventory_distributions_quantity_positive";

alter table "public"."inventory_distributions" add constraint "inventory_distributions_status_valid" CHECK ((status = ANY (ARRAY['pending'::text, 'acknowledged'::text, 'in_use'::text, 'returned'::text, 'consumed'::text, 'cancelled'::text]))) not valid;

alter table "public"."inventory_distributions" validate constraint "inventory_distributions_status_valid";

alter table "public"."inventory_distributions" add constraint "inventory_distributions_unit_cost_non_negative" CHECK ((unit_cost >= (0)::numeric)) not valid;

alter table "public"."inventory_distributions" validate constraint "inventory_distributions_unit_cost_non_negative";

alter table "public"."inventory_items" add constraint "inventory_items_store_id_fkey1" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_items" validate constraint "inventory_items_store_id_fkey1";

alter table "public"."inventory_transaction_items" add constraint "inventory_transaction_items_purchase_unit_id_fkey" FOREIGN KEY (purchase_unit_id) REFERENCES public.store_product_purchase_units(id) ON DELETE SET NULL not valid;

alter table "public"."inventory_transaction_items" validate constraint "inventory_transaction_items_purchase_unit_id_fkey";

alter table "public"."sale_tickets" add constraint "sale_tickets_approval_performer_id_fkey" FOREIGN KEY (approval_performer_id) REFERENCES public.employees(id) not valid;

alter table "public"."sale_tickets" validate constraint "sale_tickets_approval_performer_id_fkey";

alter table "public"."store_product_preferences" add constraint "store_product_preferences_last_purchase_cost_non_negative" CHECK ((last_purchase_cost >= (0)::numeric)) not valid;

alter table "public"."store_product_preferences" validate constraint "store_product_preferences_last_purchase_cost_non_negative";

alter table "public"."store_product_preferences" add constraint "store_product_preferences_last_used_purchase_unit_id_fkey" FOREIGN KEY (last_used_purchase_unit_id) REFERENCES public.store_product_purchase_units(id) ON DELETE SET NULL not valid;

alter table "public"."store_product_preferences" validate constraint "store_product_preferences_last_used_purchase_unit_id_fkey";

alter table "public"."store_product_preferences" add constraint "store_product_preferences_unique_store_item" UNIQUE using index "store_product_preferences_unique_store_item";

alter table "public"."store_product_purchase_units" add constraint "store_product_purchase_units_multiplier_positive" CHECK ((multiplier > (0)::numeric)) not valid;

alter table "public"."store_product_purchase_units" validate constraint "store_product_purchase_units_multiplier_positive";

alter table "public"."store_product_purchase_units" add constraint "store_product_purchase_units_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE not valid;

alter table "public"."store_product_purchase_units" validate constraint "store_product_purchase_units_store_id_fkey";

alter table "public"."store_product_purchase_units" add constraint "store_product_purchase_units_unique_name" UNIQUE using index "store_product_purchase_units_unique_name";

alter table "public"."store_product_purchase_units" add constraint "store_product_purchase_units_unit_name_not_empty" CHECK ((unit_name <> ''::text)) not valid;

alter table "public"."store_product_purchase_units" validate constraint "store_product_purchase_units_unit_name_not_empty";

alter table "public"."ticket_items" add constraint "ticket_items_service_reference_check" CHECK (((store_service_id IS NOT NULL) OR (custom_service_name IS NOT NULL))) not valid;

alter table "public"."ticket_items" validate constraint "ticket_items_service_reference_check";

alter table "public"."employee_inventory" add constraint "employee_inventory_unique_employee_item" UNIQUE using index "employee_inventory_unique_employee_item";

alter table "public"."employees" add constraint "employees_pay_type_valid" CHECK ((pay_type = ANY (ARRAY['hourly'::text, 'daily'::text, 'commission'::text]))) not valid;

alter table "public"."employees" validate constraint "employees_pay_type_valid";

alter table "public"."employees" add constraint "employees_role_valid" CHECK ((role <@ ARRAY['Technician'::text, 'Receptionist'::text, 'Manager'::text, 'Owner'::text, 'Supervisor'::text, 'Cashier'::text, 'Admin'::text])) not valid;

alter table "public"."employees" validate constraint "employees_role_valid";

alter table "public"."inventory_distributions" add constraint "inventory_distributions_to_employee_id_fkey" FOREIGN KEY (to_employee_id) REFERENCES public.employees(id) ON DELETE CASCADE not valid;

alter table "public"."inventory_distributions" validate constraint "inventory_distributions_to_employee_id_fkey";

alter table "public"."store_services" add constraint "store_services_service_id_fkey" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE not valid;

alter table "public"."store_services" validate constraint "store_services_service_id_fkey";

alter table "public"."ticket_items" add constraint "ticket_items_store_service_id_fkey" FOREIGN KEY (store_service_id) REFERENCES public.store_services(id) ON DELETE RESTRICT not valid;

alter table "public"."ticket_items" validate constraint "ticket_items_store_service_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.approve_violation_report(p_violation_report_id uuid, p_reviewer_employee_id uuid, p_decision text, p_manager_notes text DEFAULT NULL::text, p_action_type text DEFAULT 'none'::text, p_action_details text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_report record;
  v_final_status text;
  v_action_id uuid;
BEGIN
  -- Get report details
  SELECT * INTO v_report
  FROM public.queue_violation_reports
  WHERE id = p_violation_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Violation report not found';
  END IF;

  -- Validate decision
  IF p_decision NOT IN ('violation_confirmed', 'no_violation') THEN
    RAISE EXCEPTION 'Invalid decision. Must be violation_confirmed or no_violation';
  END IF;

  -- Validate that reviewer is not the reporter or reported employee
  IF p_reviewer_employee_id IN (v_report.reporter_employee_id, v_report.reported_employee_id) THEN
    RAISE EXCEPTION 'Reviewer cannot be the reporter or reported employee';
  END IF;

  -- Set final status based on decision
  v_final_status := CASE
    WHEN p_decision = 'violation_confirmed' THEN 'approved'
    ELSE 'rejected'
  END;

  -- Update the report
  UPDATE public.queue_violation_reports
  SET
    status = v_final_status,
    manager_decision = p_decision,
    manager_notes = p_manager_notes,
    reviewed_by_employee_id = p_reviewer_employee_id,
    reviewed_at = now()
  WHERE id = p_violation_report_id;

  -- If violation confirmed and action specified, record the action
  IF p_decision = 'violation_confirmed' AND p_action_type != 'none' THEN
    INSERT INTO public.queue_violation_actions (
      violation_report_id,
      action_type,
      action_details,
      created_by_employee_id
    ) VALUES (
      p_violation_report_id,
      p_action_type,
      p_action_details,
      p_reviewer_employee_id
    )
    RETURNING id INTO v_action_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', v_final_status,
    'decision', p_decision,
    'action_created', v_action_id IS NOT NULL
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_approve_and_log()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_result json;
BEGIN
  -- Run auto-approval
  SELECT auto_approve_expired_tickets() INTO v_result;
  
  -- Log the activity
  PERFORM log_auto_approval_activity();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_approve_with_monitoring(p_source text DEFAULT 'cron'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start_time timestamptz;
  v_result jsonb;
  v_duration_ms integer;
  v_error_message text;
BEGIN
  v_start_time := clock_timestamp();

  BEGIN
    -- Run the auto-approval function and cast result to jsonb
    SELECT public.auto_approve_expired_tickets()::jsonb INTO v_result;

    v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::integer;

    -- Log the run
    INSERT INTO public.auto_approval_runs (
      executed_at,
      tickets_approved,
      stores_processed,
      result,
      source,
      duration_ms
    ) VALUES (
      now(),
      COALESCE((v_result->>'count')::integer, 0),
      CASE 
        WHEN v_result->'stores_processed' IS NOT NULL 
        THEN ARRAY(SELECT jsonb_array_elements_text(v_result->'stores_processed')::uuid)
        ELSE ARRAY[]::uuid[]
      END,
      v_result,
      p_source,
      v_duration_ms
    );

  EXCEPTION WHEN OTHERS THEN
    v_error_message := SQLERRM;
    v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::integer;

    -- Log the error
    INSERT INTO public.auto_approval_runs (
      executed_at,
      tickets_approved,
      result,
      source,
      duration_ms,
      error_message
    ) VALUES (
      now(),
      0,
      jsonb_build_object('success', false, 'error', v_error_message),
      p_source,
      v_duration_ms,
      v_error_message
    );

    v_result := jsonb_build_object(
      'success', false,
      'error', v_error_message
    );
  END;

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_complete_previous_tickets()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.auto_populate_ticket_item_started_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Only set started_at if it's not already provided
  IF NEW.started_at IS NULL THEN
    NEW.started_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_release_queue_at_closing()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_eastern_time timestamptz;
  v_eastern_time_only time;
  v_day_of_week integer;
BEGIN
  -- Get current time in Eastern timezone
  v_eastern_time := now() AT TIME ZONE 'America/New_York';
  v_eastern_time_only := v_eastern_time::time;
  
  -- Get day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  v_day_of_week := EXTRACT(DOW FROM v_eastern_time);
  
  -- Check if we should clear the queue based on day and time
  -- Monday (1), Tuesday (2), Wednesday (3): Close at 17:30
  IF v_day_of_week IN (1, 2, 3) AND v_eastern_time_only >= '17:30:00'::time AND v_eastern_time_only < '17:45:00'::time THEN
    DELETE FROM technician_ready_queue;
    RETURN;
  END IF;
  
  -- Thursday (4), Friday (5): Close at 21:00
  IF v_day_of_week IN (4, 5) AND v_eastern_time_only >= '21:00:00'::time AND v_eastern_time_only < '21:15:00'::time THEN
    DELETE FROM technician_ready_queue;
    RETURN;
  END IF;
  
  -- Saturday (6): Close at 17:00
  IF v_day_of_week = 6 AND v_eastern_time_only >= '17:00:00'::time AND v_eastern_time_only < '17:15:00'::time THEN
    DELETE FROM technician_ready_queue;
    RETURN;
  END IF;
  
  -- Sunday (0): Close at 17:00
  IF v_day_of_week = 0 AND v_eastern_time_only >= '17:00:00'::time AND v_eastern_time_only < '17:15:00'::time THEN
    DELETE FROM technician_ready_queue;
    RETURN;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_set_completed_at_on_close()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Check if ticket is being closed (closed_at is being set from null to a value)
  IF NEW.closed_at IS NOT NULL AND (OLD.closed_at IS NULL OR OLD.closed_at IS DISTINCT FROM NEW.closed_at) THEN
    -- If completed_at is not already set, copy closed_at to completed_at
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NEW.closed_at;
      NEW.completed_by := NEW.closed_by;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.backfill_historical_auto_checkout()
 RETURNS TABLE(records_updated bigint, store_id uuid, store_name text, affected_dates text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  WITH updated_records AS (
    UPDATE public.attendance_records ar
    SET 
      check_out_time = (ar.date AT TIME ZONE s.timezone + s.closing_time) AT TIME ZONE s.timezone,
      updated_at = now()
    FROM public.stores s
    WHERE 
      ar.store_id = s.id
      AND s.closing_time IS NOT NULL
      AND ar.check_out_time IS NULL
      AND ar.date < CURRENT_DATE
    RETURNING ar.store_id, ar.date
  )
  SELECT 
    COUNT(*)::bigint as records_updated,
    ur.store_id,
    s.name as store_name,
    array_agg(DISTINCT ur.date::text ORDER BY ur.date::text) as affected_dates
  FROM updated_records ur
  JOIN public.stores s ON s.id = ur.store_id
  GROUP BY ur.store_id, s.name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.backfill_historical_auto_checkout(p_start_date date DEFAULT '2000-01-01'::date, p_end_date date DEFAULT (CURRENT_DATE - '1 day'::interval))
 RETURNS TABLE(records_processed integer, records_updated integer, records_skipped integer, earliest_date date, latest_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_record RECORD;
  v_last_ticket_time timestamptz;
  v_store_closing_time timestamptz;
  v_checkout_time timestamptz;
  v_hours numeric;
  v_day_of_week text;
  v_closing_time_str text;
  v_checkout_source text;
  v_note_addition text;
  v_fallback_time timestamptz;
  v_backfill_timestamp text;
  v_processed integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
  v_earliest_date date := NULL;
  v_latest_date date := NULL;
BEGIN
  -- Get current timestamp for backfill note
  v_backfill_timestamp := to_char(now() AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24:MI');

  -- Loop through all checked-in employees in the date range
  FOR v_record IN
    SELECT
      ar.id as attendance_id,
      ar.employee_id,
      ar.store_id,
      ar.check_in_time,
      ar.work_date,
      ar.notes,
      s.closing_hours
    FROM public.attendance_records ar
    JOIN public.stores s ON ar.store_id = s.id
    WHERE ar.status = 'checked_in'
      AND ar.work_date >= p_start_date
      AND ar.work_date <= p_end_date
    ORDER BY ar.work_date
  LOOP
    v_processed := v_processed + 1;

    -- Track date range
    IF v_earliest_date IS NULL OR v_record.work_date < v_earliest_date THEN
      v_earliest_date := v_record.work_date;
    END IF;
    IF v_latest_date IS NULL OR v_record.work_date > v_latest_date THEN
      v_latest_date := v_record.work_date;
    END IF;

    -- Get day of week for this specific date
    v_day_of_week := lower(trim(to_char(v_record.work_date, 'Day')));

    -- Get the last ticket closing time for this employee on this date
    SELECT MAX(st.closed_at) INTO v_last_ticket_time
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = v_record.employee_id
      AND st.store_id = v_record.store_id
      AND st.ticket_date = v_record.work_date
      AND st.closed_at IS NOT NULL;

    -- Get store closing time for this day of week
    v_store_closing_time := NULL;
    IF v_record.closing_hours IS NOT NULL THEN
      v_closing_time_str := v_record.closing_hours->>v_day_of_week;

      IF v_closing_time_str IS NOT NULL THEN
        -- Build closing time as timestamptz in Eastern timezone
        v_store_closing_time := (
          (v_record.work_date || ' ' || v_closing_time_str)::timestamp
          AT TIME ZONE 'America/New_York'
        );
      END IF;
    END IF;

    -- Fallback time: 21:00 on the work date (for dates before closing_hours existed)
    v_fallback_time := (
      (v_record.work_date || ' 21:00:00')::timestamp
      AT TIME ZONE 'America/New_York'
    );

    -- Determine checkout time using Option C logic: GREATEST of both times
    IF v_last_ticket_time IS NOT NULL AND v_store_closing_time IS NOT NULL THEN
      -- Both times available: use whichever is LATER
      IF v_last_ticket_time > v_store_closing_time THEN
        v_checkout_time := v_last_ticket_time;
        v_checkout_source := 'late_ticket';
      ELSE
        v_checkout_time := v_store_closing_time;
        v_checkout_source := 'store_hours';
      END IF;
    ELSIF v_last_ticket_time IS NOT NULL THEN
      -- Only ticket time available
      v_checkout_time := v_last_ticket_time;
      v_checkout_source := 'ticket_only';
    ELSIF v_store_closing_time IS NOT NULL THEN
      -- Only store closing time available
      v_checkout_time := v_store_closing_time;
      v_checkout_source := 'store_hours_only';
    ELSE
      -- Neither time available - use fallback
      v_checkout_time := v_fallback_time;
      v_checkout_source := 'fallback_21:00';
    END IF;

    -- Calculate hours worked
    v_hours := EXTRACT(EPOCH FROM (v_checkout_time - v_record.check_in_time)) / 3600;

    -- Validate hours is not negative
    IF v_hours < 0 THEN
      -- Log error and skip
      RAISE WARNING 'Negative hours for attendance_id %, skipping', v_record.attendance_id;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Build note addition with backfill timestamp
    v_note_addition := ' [Backfilled: ' || v_backfill_timestamp || ' | ' || v_checkout_source || ']';

    -- Update attendance record
    UPDATE public.attendance_records
    SET
      check_out_time = v_checkout_time,
      total_hours = v_hours,
      status = 'auto_checked_out',
      notes = COALESCE(notes, '') || v_note_addition,
      updated_at = now()
    WHERE id = v_record.attendance_id;

    v_updated := v_updated + 1;

  END LOOP;

  -- Return summary statistics
  records_processed := v_processed;
  records_updated := v_updated;
  records_skipped := v_skipped;
  earliest_date := v_earliest_date;
  latest_date := v_latest_date;

  RETURN NEXT;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_closing_cash_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.closing_cash_amount := (
    (COALESCE(NEW.closing_bill_100, 0) * 100.00) +
    (COALESCE(NEW.closing_bill_50, 0) * 50.00) +
    (COALESCE(NEW.closing_bill_20, 0) * 20.00) +
    (COALESCE(NEW.closing_bill_10, 0) * 10.00) +
    (COALESCE(NEW.closing_bill_5, 0) * 5.00) +
    (COALESCE(NEW.closing_bill_2, 0) * 2.00) +
    (COALESCE(NEW.closing_bill_1, 0) * 1.00) +
    (COALESCE(NEW.closing_coin_25, 0) * 0.25) +
    (COALESCE(NEW.closing_coin_10, 0) * 0.10) +
    (COALESCE(NEW.closing_coin_5, 0) * 0.05)
  )::numeric(10, 2);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_opening_cash_amount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.opening_cash_amount := (
    (COALESCE(NEW.bill_100, 0) * 100.00) +
    (COALESCE(NEW.bill_50, 0) * 50.00) +
    (COALESCE(NEW.bill_20, 0) * 20.00) +
    (COALESCE(NEW.bill_10, 0) * 10.00) +
    (COALESCE(NEW.bill_5, 0) * 5.00) +
    (COALESCE(NEW.bill_2, 0) * 2.00) +
    (COALESCE(NEW.bill_1, 0) * 1.00) +
    (COALESCE(NEW.coin_25, 0) * 0.25) +
    (COALESCE(NEW.coin_10, 0) * 0.10) +
    (COALESCE(NEW.coin_5, 0) * 0.05)
  )::numeric(10, 2);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_service_average_duration(p_store_service_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
  v_avg_duration numeric;
  v_sample_count integer;
  v_precise_count integer;
  v_estimated_count integer;
  v_data_quality text;
BEGIN
  -- Calculate durations using a CTE that combines precise and estimated data
  WITH service_durations AS (
    -- Get precise durations from ticket_items with both timestamps
    SELECT 
      EXTRACT(EPOCH FROM (ti.completed_at - ti.started_at)) / 60 AS duration_minutes,
      'precise' AS source_type
    FROM public.ticket_items ti
    WHERE 
      ti.store_service_id = p_store_service_id
      AND ti.started_at IS NOT NULL
      AND ti.completed_at IS NOT NULL
      AND EXTRACT(EPOCH FROM (ti.completed_at - ti.started_at)) / 60 BETWEEN 1 AND 300
    
    UNION ALL
    
    -- Get estimated durations from ticket-level timestamps
    -- Divide total ticket duration by number of services on the ticket
    SELECT 
      (EXTRACT(EPOCH FROM (st.closed_at - st.opened_at)) / 60) / 
        NULLIF((SELECT COUNT(*) FROM public.ticket_items ti2 WHERE ti2.sale_ticket_id = st.id), 0) AS duration_minutes,
      'estimated' AS source_type
    FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE 
      ti.store_service_id = p_store_service_id
      AND ti.started_at IS NULL  -- Only use as fallback when precise timing is missing
      AND st.opened_at IS NOT NULL
      AND st.closed_at IS NOT NULL
      -- Filter outliers after division
      AND (EXTRACT(EPOCH FROM (st.closed_at - st.opened_at)) / 60) / 
          NULLIF((SELECT COUNT(*) FROM public.ticket_items ti2 WHERE ti2.sale_ticket_id = st.id), 0) BETWEEN 1 AND 300
  )
  SELECT 
    AVG(duration_minutes)::numeric,
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE source_type = 'precise')::integer,
    COUNT(*) FILTER (WHERE source_type = 'estimated')::integer
  INTO v_avg_duration, v_sample_count, v_precise_count, v_estimated_count
  FROM service_durations;

  -- Determine data quality
  IF v_precise_count > 0 AND v_estimated_count = 0 THEN
    v_data_quality := 'precise';
  ELSIF v_precise_count = 0 AND v_estimated_count > 0 THEN
    v_data_quality := 'estimated';
  ELSIF v_precise_count > 0 AND v_estimated_count > 0 THEN
    v_data_quality := 'mixed';
  ELSE
    v_data_quality := 'no_data';
  END IF;

  -- Return NULL for average if we have fewer than 5 samples
  IF v_sample_count < 5 THEN
    v_result := jsonb_build_object(
      'average_duration', NULL,
      'sample_count', v_sample_count,
      'data_quality', v_data_quality
    );
  ELSE
    v_result := jsonb_build_object(
      'average_duration', ROUND(v_avg_duration)::integer,
      'sample_count', v_sample_count,
      'data_quality', v_data_quality
    );
  END IF;

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_weighted_average_cost(p_store_id uuid, p_master_item_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_weighted_avg numeric;
BEGIN
  SELECT
    CASE
      WHEN SUM(quantity_remaining) > 0 THEN
        SUM(quantity_remaining * unit_cost) / SUM(quantity_remaining)
      ELSE 0
    END
  INTO v_weighted_avg
  FROM public.inventory_purchase_lots
  WHERE store_id = p_store_id
    AND master_item_id = p_master_item_id
    AND status = 'active'
    AND quantity_remaining > 0;

  RETURN COALESCE(v_weighted_avg, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_checkin_now(p_store_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current_time time;
  v_checkin_allowed_time time := '08:45:00'::time;
  v_store_timezone text;
BEGIN
  -- Get store timezone (defaults to America/New_York if not configured)
  v_store_timezone := public.get_store_timezone(p_store_id);

  -- Get current time in store's timezone
  v_current_time := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::time;

  -- Allow check-in if current time is 8:45 AM or later
  RETURN v_current_time >= v_checkin_allowed_time;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_approval_routing()
 RETURNS TABLE(issue_type text, ticket_count bigint, example_ticket_ids text[])
 LANGUAGE sql
 STABLE
AS $function$
  -- Check 1: Supervisor closed but didn't perform - should be 'technician' level
  SELECT
    'Supervisor closed but did not perform (should be technician level)' as issue_type,
    COUNT(*) as ticket_count,
    (ARRAY_AGG(id::text))[1:5] as example_ticket_ids
  FROM sale_tickets
  WHERE approval_status = 'pending_approval'
    AND approval_required_level = 'manager'
    AND closed_by_roles @> '["Supervisor"]'::jsonb
    AND closed_by NOT IN (
      SELECT DISTINCT ti.employee_id
      FROM ticket_items ti
      WHERE ti.sale_ticket_id = sale_tickets.id
    )

  UNION ALL

  -- Check 2: Multiple performers, closer is one of them - should be 'technician' level
  SELECT
    'Multiple performers, one closed (should be technician level)' as issue_type,
    COUNT(*) as ticket_count,
    (ARRAY_AGG(id::text))[1:5] as example_ticket_ids
  FROM sale_tickets
  WHERE approval_status = 'pending_approval'
    AND approval_required_level IN ('supervisor', 'manager')
    AND (
      SELECT COUNT(DISTINCT ti.employee_id)
      FROM ticket_items ti
      WHERE ti.sale_ticket_id = sale_tickets.id
    ) > 1

  UNION ALL

  -- Check 3: Correctly routed tickets (for verification)
  SELECT
    'Correctly routed to technician level' as issue_type,
    COUNT(*) as ticket_count,
    (ARRAY_AGG(id::text))[1:5] as example_ticket_ids
  FROM sale_tickets
  WHERE approval_status = 'pending_approval'
    AND approval_required_level = 'technician';
$function$
;

CREATE OR REPLACE FUNCTION public.check_opening_cash_recorded(p_store_id uuid, p_date date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_has_opening_cash boolean;
BEGIN
  SELECT (
    (opening_cash_amount IS NOT NULL AND opening_cash_amount > 0) OR
    (bill_100 IS NOT NULL AND bill_100 > 0) OR
    (bill_50 IS NOT NULL AND bill_50 > 0) OR
    (bill_20 IS NOT NULL AND bill_20 > 0) OR
    (bill_10 IS NOT NULL AND bill_10 > 0) OR
    (bill_5 IS NOT NULL AND bill_5 > 0) OR
    (bill_2 IS NOT NULL AND bill_2 > 0) OR
    (bill_1 IS NOT NULL AND bill_1 > 0) OR
    (coin_25 IS NOT NULL AND coin_25 > 0) OR
    (coin_10 IS NOT NULL AND coin_10 > 0) OR
    (coin_5 IS NOT NULL AND coin_5 > 0)
  ) INTO v_has_opening_cash
  FROM public.end_of_day_records
  WHERE store_id = p_store_id
    AND date = p_date;

  RETURN COALESCE(v_has_opening_cash, false);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_previous_unclosed_tickets(p_store_id uuid, p_ticket_date date)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.sale_tickets
    WHERE store_id = p_store_id
      AND ticket_date < p_ticket_date
      AND closed_at IS NULL
    LIMIT 1
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.clear_store_ready_queue(p_store_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM technician_ready_queue
  WHERE store_id = p_store_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.consume_employee_inventory(p_employee_id uuid, p_master_item_id uuid, p_quantity numeric, p_notes text DEFAULT ''::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining_qty numeric;
  v_emp_lot record;
  v_consume_qty numeric;
  v_result json;
BEGIN
  v_remaining_qty := p_quantity;

  -- Validate employee has enough inventory
  IF (SELECT COALESCE(SUM(quantity), 0)
      FROM public.employee_inventory_lots
      WHERE employee_id = p_employee_id
        AND master_item_id = p_master_item_id) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient employee inventory for consumption';
  END IF;

  -- Process each employee lot in FIFO order
  FOR v_emp_lot IN
    SELECT id, lot_id, quantity, unit_cost, distributed_date
    FROM public.employee_inventory_lots
    WHERE employee_id = p_employee_id
      AND master_item_id = p_master_item_id
    ORDER BY distributed_date ASC
  LOOP
    EXIT WHEN v_remaining_qty <= 0;

    v_consume_qty := LEAST(v_remaining_qty, v_emp_lot.quantity);

    -- Remove or update employee lot record
    IF v_consume_qty >= v_emp_lot.quantity THEN
      DELETE FROM public.employee_inventory_lots WHERE id = v_emp_lot.id;
    ELSE
      UPDATE public.employee_inventory_lots
      SET quantity = quantity - v_consume_qty,
          updated_at = now()
      WHERE id = v_emp_lot.id;
    END IF;

    v_remaining_qty := v_remaining_qty - v_consume_qty;
  END LOOP;

  -- Update employee inventory summary
  PERFORM public.refresh_employee_inventory_summary(p_employee_id, p_master_item_id);

  v_result := json_build_object(
    'success', true,
    'consumed_quantity', p_quantity
  );

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.copy_role_permissions(p_store_id uuid, p_from_role text, p_to_role text, p_employee_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_perm record;
BEGIN
  -- Copy all permissions from source role to target role
  FOR v_perm IN
    SELECT permission_key, is_enabled
    FROM public.role_permissions
    WHERE store_id = p_store_id AND role_name = p_from_role
  LOOP
    INSERT INTO public.role_permissions (store_id, role_name, permission_key, is_enabled, created_by, updated_by)
    VALUES (p_store_id, p_to_role, v_perm.permission_key, v_perm.is_enabled, p_employee_id, p_employee_id)
    ON CONFLICT (store_id, role_name, permission_key)
    DO UPDATE SET
      is_enabled = v_perm.is_enabled,
      updated_by = p_employee_id,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_default_purchase_unit_for_store_item(p_store_id uuid, p_master_item_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_id uuid;
  v_unit_name text;
BEGIN
  -- Get the base unit from master item
  SELECT unit INTO v_unit_name
  FROM public.master_inventory_items
  WHERE id = p_master_item_id;

  -- Check if a purchase unit already exists
  SELECT id INTO v_unit_id
  FROM public.store_product_purchase_units
  WHERE store_id = p_store_id
    AND master_item_id = p_master_item_id
  LIMIT 1;

  -- If no units exist, create default single unit
  IF v_unit_id IS NULL THEN
    INSERT INTO public.store_product_purchase_units (
      store_id,
      master_item_id,
      unit_name,
      multiplier,
      is_default,
      display_order
    ) VALUES (
      p_store_id,
      p_master_item_id,
      'Single ' || COALESCE(v_unit_name, 'unit'),
      1,
      true,
      0
    )
    RETURNING id INTO v_unit_id;
  END IF;

  RETURN v_unit_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_inventory_transaction_atomic(p_store_id uuid, p_transaction_type text, p_requested_by_id uuid, p_recipient_id uuid DEFAULT NULL::uuid, p_supplier_id uuid DEFAULT NULL::uuid, p_invoice_reference text DEFAULT NULL::text, p_notes text DEFAULT ''::text, p_requires_manager_approval boolean DEFAULT true, p_requires_recipient_approval boolean DEFAULT false)
 RETURNS TABLE(id uuid, transaction_number text, store_id uuid, transaction_type text, requested_by_id uuid, recipient_id uuid, supplier_id uuid, invoice_reference text, notes text, status text, requires_manager_approval boolean, requires_recipient_approval boolean, manager_approved boolean, recipient_approved boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    DECLARE
      v_date_str text;
      v_prefix text;
      v_next_num integer;
      v_transaction_number text;
      v_lock_key bigint;
      v_new_transaction record;
    BEGIN
      IF p_store_id IS NULL THEN
        RAISE EXCEPTION 'store_id cannot be null';
      END IF;

      IF p_requested_by_id IS NULL THEN
        RAISE EXCEPTION 'requested_by_id cannot be null';
      END IF;

      IF p_transaction_type NOT IN ('in', 'out') THEN
        RAISE EXCEPTION 'transaction_type must be either in or out';
      END IF;

      v_date_str := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

      v_prefix := CASE
        WHEN p_transaction_type = 'in' THEN 'IN'
        WHEN p_transaction_type = 'out' THEN 'OUT'
        ELSE 'TXN'
      END;

      v_lock_key := hashtext(p_store_id::text || '-' || v_prefix || '-' || v_date_str);

      PERFORM pg_advisory_xact_lock(v_lock_key);

      SELECT COALESCE(MAX(
        CAST(
          SUBSTRING(inventory_transactions.transaction_number FROM '\d+$') AS INTEGER
        )
      ), 0) + 1
      INTO v_next_num
      FROM public.inventory_transactions
      WHERE inventory_transactions.transaction_number LIKE v_prefix || '-' || v_date_str || '-%'
        AND inventory_transactions.store_id = p_store_id;

      v_transaction_number := v_prefix || '-' || v_date_str || '-' || LPAD(v_next_num::text, 4, '0');

      INSERT INTO public.inventory_transactions (
        store_id,
        transaction_type,
        transaction_number,
        requested_by_id,
        recipient_id,
        supplier_id,
        invoice_reference,
        notes,
        status,
        requires_manager_approval,
        requires_recipient_approval,
        manager_approved,
        recipient_approved,
        created_at,
        updated_at
      ) VALUES (
        p_store_id,
        p_transaction_type,
        v_transaction_number,
        p_requested_by_id,
        p_recipient_id,
        p_supplier_id,
        p_invoice_reference,
        p_notes,
        'pending',
        p_requires_manager_approval,
        p_requires_recipient_approval,
        false,
        false,
        NOW(),
        NOW()
      )
      RETURNING * INTO v_new_transaction;

      RETURN QUERY SELECT
        v_new_transaction.id,
        v_new_transaction.transaction_number,
        v_new_transaction.store_id,
        v_new_transaction.transaction_type,
        v_new_transaction.requested_by_id,
        v_new_transaction.recipient_id,
        v_new_transaction.supplier_id,
        v_new_transaction.invoice_reference,
        v_new_transaction.notes,
        v_new_transaction.status,
        v_new_transaction.requires_manager_approval,
        v_new_transaction.requires_recipient_approval,
        v_new_transaction.manager_approved,
        v_new_transaction.recipient_approved,
        v_new_transaction.created_at,
        v_new_transaction.updated_at;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.create_queue_violation_report(p_store_id uuid, p_employee_id uuid, p_violation_type text, p_description text, p_reporter_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_violation_id uuid;
  v_violation_date date;
  v_required_responders jsonb;
  v_working_employees jsonb;
BEGIN
  -- Get current date in EST timezone
  v_violation_date := (now() AT TIME ZONE 'America/New_York')::date;
  
  -- Get all employees working today (checked in or scheduled)
  v_working_employees := public.get_employees_working_today(p_store_id);
  
  -- Build required_responders from working employees
  v_required_responders := (
    SELECT jsonb_agg(
      jsonb_build_object(
        'employee_id', (value->>'employee_id')::uuid,
        'employee_name', value->>'employee_name',
        'has_responded', false
      )
    )
    FROM jsonb_array_elements(v_working_employees)
    WHERE (value->>'employee_id')::uuid != p_reporter_id
  );

  -- Create the violation report
  INSERT INTO public.queue_violation_reports (
    store_id,
    employee_id,
    violation_type,
    violation_date,
    description,
    reporter_id,
    required_responders,
    status
  )
  VALUES (
    p_store_id,
    p_employee_id,
    p_violation_type,
    v_violation_date,
    p_description,
    p_reporter_id,
    COALESCE(v_required_responders, '[]'::jsonb),
    'pending'
  )
  RETURNING id INTO v_violation_id;

  RETURN jsonb_build_object(
    'success', true,
    'violation_id', v_violation_id,
    'violation_date', v_violation_date
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_single_default_purchase_unit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If setting this as default, unset all other defaults for this store/item
  IF NEW.is_default = true THEN
    UPDATE public.store_product_purchase_units
    SET is_default = false, updated_at = now()
    WHERE store_id = NEW.store_id
      AND master_item_id = NEW.master_item_id
      AND id != NEW.id
      AND is_default = true;
  END IF;

  -- Ensure at least one default exists
  IF NEW.is_default = false THEN
    -- Check if there are any other defaults
    IF NOT EXISTS (
      SELECT 1 FROM public.store_product_purchase_units
      WHERE store_id = NEW.store_id
        AND master_item_id = NEW.master_item_id
        AND id != NEW.id
        AND is_default = true
    ) THEN
      -- If no other defaults, keep this one as default
      NEW.is_default := true;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.expire_old_violation_reports()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.queue_violation_reports
  SET status = 'expired'
  WHERE status = 'collecting_responses'
    AND expires_at < now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.find_or_create_global_service(p_code text, p_name text, p_category text, p_base_price numeric, p_duration_min integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_service_id uuid;
BEGIN
  -- Try to find existing service by code
  SELECT id INTO v_service_id
  FROM public.services
  WHERE code = p_code
  LIMIT 1;

  -- If not found, create new global service
  IF v_service_id IS NULL THEN
    INSERT INTO public.services (
      code,
      name,
      category,
      base_price,
      duration_min,
      active,
      archived
    )
    VALUES (
      p_code,
      p_name,
      p_category,
      p_base_price,
      p_duration_min,
      true,
      false
    )
    RETURNING id INTO v_service_id;
  END IF;

  RETURN v_service_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_audit_number(p_store_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year text;
  v_sequence int;
  v_audit_number text;
BEGIN
  v_year := to_char(now(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(audit_number FROM '\\d+$') AS integer
    )
  ), 0) + 1
  INTO v_sequence
  FROM public.inventory_audits
  WHERE store_id = p_store_id
    AND audit_number LIKE 'AUDIT-' || v_year || '-%';

  v_audit_number := 'AUDIT-' || v_year || '-' || LPAD(v_sequence::text, 4, '0');

  RETURN v_audit_number;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_distribution_number(p_store_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year text;
  v_sequence int;
  v_dist_number text;
BEGIN
  v_year := to_char(now(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(distribution_number FROM '\\d+$') AS integer
    )
  ), 0) + 1
  INTO v_sequence
  FROM public.inventory_distributions
  WHERE store_id = p_store_id
    AND distribution_number LIKE 'DIST-' || v_year || '-%';

  v_dist_number := 'DIST-' || v_year || '-' || LPAD(v_sequence::text, 4, '0');

  RETURN v_dist_number;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_lot_number(p_store_id uuid, p_supplier_code text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_year text;
  v_sequence int;
  v_prefix text;
  v_lot_number text;
BEGIN
  -- Get current year
  v_year := to_char(now(), 'YYYY');

  -- Use supplier code if provided, otherwise use 'LOT'
  v_prefix := COALESCE(p_supplier_code, 'LOT');

  -- Get next sequence number for this year and prefix
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(lot_number FROM '\\d+$') AS integer
    )
  ), 0) + 1
  INTO v_sequence
  FROM public.inventory_purchase_lots
  WHERE store_id = p_store_id
    AND lot_number LIKE v_prefix || '-' || v_year || '-%';

  -- Format: PREFIX-YYYY-NNN (e.g., SUP-2024-001)
  v_lot_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::text, 3, '0');

  RETURN v_lot_number;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_all_violation_reports_for_management(p_store_id uuid, p_status text DEFAULT NULL::text, p_date_from date DEFAULT NULL::date, p_date_to date DEFAULT NULL::date, p_search_employee text DEFAULT NULL::text)
 RETURNS TABLE(report_id uuid, reported_employee_id uuid, reported_employee_name text, reporter_employee_id uuid, reporter_employee_name text, violation_description text, violation_date date, queue_position integer, status text, created_at timestamp with time zone, expires_at timestamp with time zone, reviewed_by_id uuid, reviewed_by_name text, reviewed_at timestamp with time zone, decision text, action_type text, action_details text, manager_notes text, total_required_responders integer, total_responses integer, votes_violation integer, votes_no_violation integer, responses jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    vr.id AS report_id,
    vr.reported_employee_id,
    reported_emp.display_name AS reported_employee_name,
    vr.reporter_employee_id,
    reporter_emp.display_name AS reporter_employee_name,
    vr.violation_description,
    vr.violation_date,
    vr.queue_position_claimed AS queue_position,
    vr.status,
    vr.created_at,
    vr.expires_at,
    vr.reviewed_by_employee_id AS reviewed_by_id,
    reviewed_emp.display_name AS reviewed_by_name,
    vr.reviewed_at,
    vr.manager_decision AS decision,
    va.action_type,
    va.action_details,
    vr.manager_notes,
    vr.total_responses_required AS total_required_responders,
    (
      SELECT COUNT(*)::integer
      FROM public.queue_violation_responses vresp
      WHERE vresp.violation_report_id = vr.id
    ) AS total_responses,
    (
      SELECT COUNT(*)::integer
      FROM public.queue_violation_responses vresp
      WHERE vresp.violation_report_id = vr.id
        AND vresp.response = true
    ) AS votes_violation,
    (
      SELECT COUNT(*)::integer
      FROM public.queue_violation_responses vresp
      WHERE vresp.violation_report_id = vr.id
        AND vresp.response = false
    ) AS votes_no_violation,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'response_id', vresp.id,
          'responder_employee_id', vresp.employee_id,
          'responder_employee_name', resp_emp.display_name,
          'vote', CASE WHEN vresp.response = true THEN 'violation' ELSE 'no_violation' END,
          'notes', vresp.response_notes,
          'responded_at', vresp.responded_at
        )
        ORDER BY vresp.responded_at DESC
      )
      FROM public.queue_violation_responses vresp
      LEFT JOIN public.employees resp_emp ON resp_emp.id = vresp.employee_id
      WHERE vresp.violation_report_id = vr.id
    ) AS responses
  FROM public.queue_violation_reports vr
  LEFT JOIN public.employees reported_emp ON reported_emp.id = vr.reported_employee_id
  LEFT JOIN public.employees reporter_emp ON reporter_emp.id = vr.reporter_employee_id
  LEFT JOIN public.employees reviewed_emp ON reviewed_emp.id = vr.reviewed_by_employee_id
  LEFT JOIN public.queue_violation_actions va ON va.violation_report_id = vr.id
  WHERE vr.store_id = p_store_id
    AND (p_status IS NULL OR vr.status = p_status)
    AND (p_date_from IS NULL OR vr.violation_date >= p_date_from)
    AND (p_date_to IS NULL OR vr.violation_date <= p_date_to)
    AND (
      p_search_employee IS NULL
      OR reported_emp.display_name ILIKE '%' || p_search_employee || '%'
      OR reporter_emp.display_name ILIKE '%' || p_search_employee || '%'
    )
  ORDER BY
    CASE
      WHEN vr.status = 'pending_approval' THEN 1
      WHEN vr.status = 'collecting_responses' THEN 2
      WHEN vr.status = 'expired' THEN 3
      WHEN vr.status = 'approved' THEN 4
      WHEN vr.status = 'rejected' THEN 5
      ELSE 6
    END,
    vr.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_approval_correction_diagnostics()
 RETURNS TABLE(total_tickets bigint, manually_approved_incorrectly bigint, auto_approved_correctly bigint, needs_correction bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_tickets,
    COUNT(*) FILTER (WHERE st.approval_status = 'manually_approved' AND st.requires_higher_approval = false)::bigint as manually_approved_incorrectly,
    COUNT(*) FILTER (WHERE st.approval_status = 'auto_approved' AND st.requires_higher_approval = false)::bigint as auto_approved_correctly,
    COUNT(*) FILTER (WHERE st.approval_status = 'manually_approved' AND st.requires_higher_approval = false)::bigint as needs_correction
  FROM public.sale_tickets st;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_approval_correction_summary()
 RETURNS TABLE(corrected_count bigint, correction_timestamp timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as corrected_count,
    MAX(corrected_at) as correction_timestamp
  FROM public.approval_status_correction_audit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_approval_statistics(p_store_id uuid DEFAULT NULL::uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(total_closed integer, pending_approval integer, approved integer, auto_approved integer, rejected integer, requires_review integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer as total_closed,
    COUNT(*) FILTER (WHERE approval_status = 'pending_approval')::integer as pending_approval,
    COUNT(*) FILTER (WHERE approval_status = 'approved')::integer as approved,
    COUNT(*) FILTER (WHERE approval_status = 'auto_approved')::integer as auto_approved,
    COUNT(*) FILTER (WHERE approval_status = 'rejected')::integer as rejected,
    COUNT(*) FILTER (WHERE requires_admin_review = true)::integer as requires_review
  FROM sale_tickets
  WHERE closed_at IS NOT NULL
    AND (p_store_id IS NULL OR store_id = p_store_id)
    AND (p_start_date IS NULL OR ticket_date >= p_start_date)
    AND (p_end_date IS NULL OR ticket_date <= p_end_date);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_available_lots_fifo(p_store_id uuid, p_master_item_id uuid)
 RETURNS TABLE(lot_id uuid, lot_number text, quantity_remaining numeric, unit_cost numeric, purchase_date timestamp with time zone, expiration_date timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    l.id as lot_id,
    l.lot_number,
    l.quantity_remaining,
    l.unit_cost,
    l.purchase_date,
    l.expiration_date
  FROM public.inventory_purchase_lots l
  WHERE l.store_id = p_store_id
    AND l.master_item_id = p_master_item_id
    AND l.status = 'active'
    AND l.quantity_remaining > 0
  ORDER BY l.purchase_date ASC, l.created_at ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_employee_attendance_summary(p_employee_id uuid, p_start_date date, p_end_date date)
 RETURNS TABLE(work_date date, check_in_time timestamp with time zone, check_out_time timestamp with time zone, total_hours numeric, status text, store_name text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ar.work_date,
    ar.check_in_time,
    ar.check_out_time,
    ar.total_hours,
    ar.status,
    s.name as store_name
  FROM attendance_records ar
  JOIN stores s ON ar.store_id = s.id
  WHERE ar.employee_id = p_employee_id
    AND ar.work_date BETWEEN p_start_date AND p_end_date
  ORDER BY ar.work_date DESC, ar.check_in_time DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_employees_working_today(p_store_id uuid, p_date text)
 RETURNS TABLE(employee_id uuid, legal_name text, display_name text, queue_status text, queue_position integer, is_checked_in boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH working_employees AS (
    -- Get employees from attendance records
    SELECT DISTINCT
      ar.employee_id
    FROM public.attendance_records ar
    WHERE ar.store_id = p_store_id
      AND ar.work_date = p_date::date

    UNION

    -- Get employees from ticket items (worked on services)
    SELECT DISTINCT
      ti.employee_id
    FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
  ),
  current_attendance AS (
    SELECT
      ar.employee_id,
      ar.check_in_time,
      ar.check_out_time,
      ar.status
    FROM public.attendance_records ar
    WHERE ar.store_id = p_store_id
      AND ar.work_date = p_date::date
  )
  SELECT
    e.id,
    e.legal_name,
    e.display_name,
    trq.status,
    trq.queue_position::integer,
    CASE
      WHEN ca.status = 'checked_in' THEN true
      ELSE false
    END
  FROM working_employees we
  INNER JOIN public.employees e ON we.employee_id = e.id
  LEFT JOIN (
    SELECT
      trq_inner.employee_id,
      trq_inner.status,
      ROW_NUMBER() OVER (
        ORDER BY trq_inner.ready_at ASC
      ) AS queue_position
    FROM public.technician_ready_queue trq_inner
    WHERE trq_inner.store_id = p_store_id
      AND trq_inner.status = 'ready'
  ) trq ON e.id = trq.employee_id
  LEFT JOIN current_attendance ca ON e.id = ca.employee_id
  WHERE e.status = 'Active'
  ORDER BY
    CASE WHEN trq.queue_position IS NOT NULL THEN 0 ELSE 1 END,
    trq.queue_position ASC NULLS LAST,
    e.display_name ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_historical_approvals_for_manager(p_store_id uuid)
 RETURNS TABLE(ticket_id uuid, ticket_number integer, customer_name text, customer_phone text, total_amount numeric, created_at timestamp with time zone, completed_at timestamp with time zone, completed_by_id uuid, completed_by_name text, approval_status text, approved_at timestamp with time zone, approved_by_id uuid, approved_by_name text, requires_supervisor_approval boolean, service_names text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    st.id AS ticket_id,
    st.ticket_number,
    st.customer_name,
    st.customer_phone,
    st.total_amount,
    st.created_at,
    st.completed_at,
    st.completed_by_id,
    completed_by.name AS completed_by_name,
    st.approval_status,
    st.approved_at,
    st.approved_by_id,
    approved_by.name AS approved_by_name,
    st.requires_supervisor_approval,
    string_agg(DISTINCT COALESCE(ss.name, sti.custom_service_name), ', ') AS service_names
  FROM public.sale_tickets st
  LEFT JOIN public.employees completed_by ON completed_by.id = st.completed_by_id
  LEFT JOIN public.employees approved_by ON approved_by.id = st.approved_by_id
  LEFT JOIN public.ticket_items sti ON sti.ticket_id = st.id
  LEFT JOIN public.store_services ss ON ss.id = sti.store_service_id
  WHERE
    st.store_id = p_store_id
    AND st.completed_at IS NOT NULL
    AND st.approval_status IN ('approved', 'rejected')
    AND (
      st.requires_supervisor_approval = false
      OR st.requires_supervisor_approval IS NULL
    )
  GROUP BY
    st.id,
    st.ticket_number,
    st.customer_name,
    st.customer_phone,
    st.total_amount,
    st.created_at,
    st.completed_at,
    st.completed_by_id,
    completed_by.name,
    st.approval_status,
    st.approved_at,
    st.approved_by_id,
    approved_by.name,
    st.requires_supervisor_approval
  ORDER BY st.approved_at DESC NULLS LAST, st.completed_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_historical_approvals_for_supervisor(p_store_id uuid)
 RETURNS TABLE(ticket_id uuid, ticket_number integer, customer_name text, customer_phone text, total_amount numeric, created_at timestamp with time zone, completed_at timestamp with time zone, completed_by_id uuid, completed_by_name text, approval_status text, approved_at timestamp with time zone, approved_by_id uuid, approved_by_name text, requires_supervisor_approval boolean, service_names text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    st.id AS ticket_id,
    st.ticket_number,
    st.customer_name,
    st.customer_phone,
    st.total_amount,
    st.created_at,
    st.completed_at,
    st.completed_by_id,
    completed_by.name AS completed_by_name,
    st.approval_status,
    st.approved_at,
    st.approved_by_id,
    approved_by.name AS approved_by_name,
    st.requires_supervisor_approval,
    string_agg(DISTINCT COALESCE(ss.name, sti.custom_service_name), ', ') AS service_names
  FROM public.sale_tickets st
  LEFT JOIN public.employees completed_by ON completed_by.id = st.completed_by_id
  LEFT JOIN public.employees approved_by ON approved_by.id = st.approved_by_id
  LEFT JOIN public.ticket_items sti ON sti.ticket_id = st.id
  LEFT JOIN public.store_services ss ON ss.id = sti.store_service_id
  WHERE
    st.store_id = p_store_id
    AND st.completed_at IS NOT NULL
    AND st.approval_status IN ('approved', 'rejected')
    AND st.requires_supervisor_approval = true
  GROUP BY
    st.id,
    st.ticket_number,
    st.customer_name,
    st.customer_phone,
    st.total_amount,
    st.created_at,
    st.completed_at,
    st.completed_by_id,
    completed_by.name,
    st.approval_status,
    st.approved_at,
    st.approved_by_id,
    approved_by.name,
    st.requires_supervisor_approval
  ORDER BY st.approved_at DESC NULLS LAST, st.completed_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_latest_app_version()
 RETURNS TABLE(id uuid, version_number text, build_hash text, deployed_at timestamp with time zone, release_notes text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.version_number,
    v.build_hash,
    v.deployed_at,
    v.release_notes
  FROM app_versions v
  WHERE v.is_active = true
  ORDER BY v.deployed_at DESC
  LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pending_proposals_count(p_store_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM public.attendance_change_proposals acp
    INNER JOIN public.attendance_records ar ON ar.id = acp.attendance_record_id
    WHERE ar.store_id = p_store_id
      AND acp.status = 'pending'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pending_violation_responses(p_employee_id uuid, p_store_id uuid)
 RETURNS TABLE(report_id uuid, reported_employee_id uuid, reported_employee_name text, reporter_employee_id uuid, reporter_employee_name text, violation_description text, violation_date date, queue_position_claimed integer, total_responses_required integer, total_responses_received integer, expires_at timestamp with time zone, created_at timestamp with time zone, min_votes_required integer, votes_violation_confirmed integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    vr.id,
    vr.reported_employee_id,
    reported.display_name,
    vr.reporter_employee_id,
    reporter.display_name,
    vr.violation_description,
    vr.violation_date,
    vr.queue_position_claimed,
    vr.total_responses_required,
    vr.total_responses_received,
    vr.expires_at,
    vr.created_at,
    vr.min_votes_required_snapshot,
    vr.votes_violation_confirmed
  FROM public.queue_violation_reports vr
  JOIN public.employees reported ON reported.id = vr.reported_employee_id
  JOIN public.employees reporter ON reporter.id = vr.reporter_employee_id
  WHERE vr.store_id = p_store_id
    AND vr.status = 'collecting_responses'
    AND p_employee_id = ANY(vr.required_responder_ids)
    AND NOT EXISTS (
      SELECT 1 FROM public.queue_violation_responses
      WHERE violation_report_id = vr.id AND employee_id = p_employee_id
    )
  ORDER BY vr.created_at ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_permission_audit_log(p_store_id uuid, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, role_name text, permission_key text, old_value boolean, new_value boolean, changed_by_name text, changed_at timestamp with time zone, change_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    rpa.id,
    rpa.role_name,
    rpa.permission_key,
    rpa.old_value,
    rpa.new_value,
    e.name as changed_by_name,
    rpa.changed_at,
    rpa.change_reason
  FROM public.role_permissions_audit rpa
  LEFT JOIN public.employees e ON rpa.changed_by = e.id
  WHERE rpa.store_id = p_store_id
  ORDER BY rpa.changed_at DESC
  LIMIT p_limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_product_preference(p_store_id uuid, p_master_item_id uuid)
 RETURNS TABLE(purchase_unit_id uuid, purchase_cost numeric, last_used timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    spp.last_used_purchase_unit_id as purchase_unit_id,
    spp.last_purchase_cost as purchase_cost,
    spp.last_used_at as last_used
  FROM public.store_product_preferences spp
  WHERE spp.store_id = p_store_id
    AND spp.master_item_id = p_master_item_id
  LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_queue_removal_history(p_store_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, employee_id uuid, employee_name text, employee_code text, removed_by_employee_id uuid, removed_by_name text, reason text, notes text, removed_at timestamp with time zone, cooldown_expires_at timestamp with time zone, is_active boolean, minutes_remaining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid;
  v_caller_role text[];
BEGIN
  -- Get caller's ID and role
  SELECT e.id, e.role INTO v_caller_id, v_caller_role
  FROM public.employees e
  WHERE e.id = auth.uid();
  
  -- Check if caller has permission (Manager, Supervisor, Admin, Owner)
  IF v_caller_id IS NULL OR NOT (v_caller_role && ARRAY['Manager', 'Supervisor', 'Admin', 'Owner']::text[]) THEN
    RAISE EXCEPTION 'You do not have permission to view queue removal history';
  END IF;
  
  -- Check if caller has access to this store
  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_stores
    WHERE employee_id = v_caller_id
      AND store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'You do not have access to this store';
  END IF;
  
  -- Return removal history with filters
  RETURN QUERY
  SELECT
    qrl.id,
    qrl.employee_id,
    e.name as employee_name,
    e.employee_code,
    qrl.removed_by_employee_id,
    remover.name as removed_by_name,
    qrl.reason,
    qrl.notes,
    qrl.removed_at,
    qrl.cooldown_expires_at,
    (qrl.cooldown_expires_at > now()) as is_active,
    CASE
      WHEN qrl.cooldown_expires_at > now() THEN
        CEIL(EXTRACT(EPOCH FROM (qrl.cooldown_expires_at - now())) / 60)::integer
      ELSE
        NULL
    END as minutes_remaining
  FROM public.queue_removals_log qrl
  JOIN public.employees e ON e.id = qrl.employee_id
  JOIN public.employees remover ON remover.id = qrl.removed_by_employee_id
  WHERE qrl.store_id = p_store_id
    AND (p_start_date IS NULL OR qrl.removed_at::date >= p_start_date)
    AND (p_end_date IS NULL OR qrl.removed_at::date <= p_end_date)
  ORDER BY qrl.removed_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_recent_function_errors(p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, function_name text, error_message text, parameters jsonb, store_id uuid, occurred_at timestamp with time zone, context text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT id, function_name, error_message, parameters, store_id, occurred_at, context
  FROM public.function_error_logs
  ORDER BY occurred_at DESC
  LIMIT p_limit;
$function$
;

CREATE OR REPLACE FUNCTION public.get_rejected_tickets_for_admin(p_store_id uuid)
 RETURNS TABLE(ticket_id uuid, ticket_no text, ticket_date date, closed_at timestamp with time zone, customer_type text, total numeric, rejection_reason text, rejected_by_id uuid, rejected_by_name text, rejected_at timestamp with time zone, technician_name text, service_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (st.id)
    st.id as ticket_id,
    st.ticket_no,
    st.ticket_date,
    st.closed_at,
    st.customer_type,
    st.total,
    st.rejection_reason,
    st.approved_by as rejected_by_id,
    e.display_name as rejected_by_name,
    st.approved_at as rejected_at,
    te.display_name as technician_name,
    COALESCE(s.name, ti.custom_service_name, 'Service') as service_name
  FROM public.sale_tickets st
  LEFT JOIN public.employees e ON e.id = st.approved_by
  LEFT JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.employees te ON te.id = ti.employee_id
  LEFT JOIN public.services s ON s.id = ti.service_id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'rejected'
    AND st.requires_admin_review = true
  ORDER BY st.id, st.closed_at DESC
  LIMIT 50;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_services_by_popularity(p_store_id uuid, p_include_all boolean DEFAULT false)
 RETURNS TABLE(id uuid, store_service_id uuid, service_id uuid, code text, name text, price numeric, duration_min integer, category text, active boolean, archived boolean, created_at timestamp with time zone, updated_at timestamp with time zone, usage_count numeric)
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- Validate required parameter
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'p_store_id parameter is required';
  END IF;

  RETURN QUERY
  WITH service_usage AS (
    SELECT
      ti.store_service_id,
      SUM(ti.qty) as total_usage
    FROM public.ticket_items ti
    JOIN public.sale_tickets st ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND ti.store_service_id IS NOT NULL
    GROUP BY ti.store_service_id
  )
  SELECT
    ss.id as id,
    ss.id as store_service_id,
    ss.id as service_id,
    ss.code as code,
    ss.name as name,
    ss.price as price,
    ss.duration_min as duration_min,
    ss.category as category,
    ss.active as active,
    COALESCE(ss.archived, false) as archived,
    ss.created_at as created_at,
    ss.updated_at as updated_at,
    COALESCE(su.total_usage, 0) as usage_count
  FROM public.store_services ss
  LEFT JOIN service_usage su ON ss.id = su.store_service_id
  WHERE ss.store_id = p_store_id
    -- Only apply active/archived filter when p_include_all is false
    AND (
      p_include_all = true
      OR (ss.active = true AND COALESCE(ss.archived, false) = false)
    )
  ORDER BY
    COALESCE(su.total_usage, 0) DESC,
    ss.code ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_supplier_for_transaction(p_transaction_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_supplier_id uuid;
BEGIN
  -- Get supplier_id from the transaction if it has one
  -- This is a placeholder - adjust based on your transaction schema
  SELECT NULL INTO v_supplier_id;
  
  RETURN v_supplier_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_technician_queue_position(p_employee_id uuid, p_store_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_position integer;
BEGIN
  SELECT COUNT(*) + 1 INTO v_position
  FROM technician_ready_queue
  WHERE store_id = p_store_id
    AND status = 'ready'
    AND ready_at < (
      SELECT ready_at
      FROM technician_ready_queue
      WHERE employee_id = p_employee_id
        AND store_id = p_store_id
    );

  RETURN COALESCE(v_position, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_violation_reports_for_approval(p_store_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(report_id uuid, reported_employee_id uuid, reported_employee_name text, reporter_employee_id uuid, reporter_employee_name text, violation_description text, violation_date date, queue_position_claimed integer, total_responses integer, votes_for_violation integer, votes_against_violation integer, response_details jsonb, created_at timestamp with time zone, status text, expires_at timestamp with time zone, votes_violation_confirmed integer, min_votes_required integer, threshold_met boolean, insufficient_responders boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    vr.id,
    vr.reported_employee_id,
    reported.display_name,
    vr.reporter_employee_id,
    reporter.display_name,
    vr.violation_description,
    vr.violation_date,
    vr.queue_position_claimed,
    vr.total_responses_received,
    (SELECT COUNT(*) FROM public.queue_violation_responses WHERE violation_report_id = vr.id AND response = true)::integer,
    (SELECT COUNT(*) FROM public.queue_violation_responses WHERE violation_report_id = vr.id AND response = false)::integer,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'employee_id', resp.employee_id,
          'employee_name', e.display_name,
          'response', resp.response,
          'response_notes', resp.response_notes,
          'responded_at', resp.responded_at
        ) ORDER BY resp.responded_at
      )
      FROM public.queue_violation_responses resp
      JOIN public.employees e ON e.id = resp.employee_id
      WHERE resp.violation_report_id = vr.id
    ),
    vr.created_at,
    vr.status,
    vr.expires_at,
    vr.votes_violation_confirmed,
    vr.min_votes_required_snapshot,
    vr.threshold_met,
    vr.insufficient_responders
  FROM public.queue_violation_reports vr
  JOIN public.employees reported ON reported.id = vr.reported_employee_id
  JOIN public.employees reporter ON reporter.id = vr.reporter_employee_id
  WHERE vr.store_id = p_store_id
    AND vr.status IN ('pending_approval', 'expired')
    AND (p_start_date IS NULL OR vr.violation_date >= p_start_date)
    AND (p_end_date IS NULL OR vr.violation_date <= p_end_date)
  ORDER BY 
    -- Sort by urgency: pending_approval first, then expired, then by creation time
    CASE vr.status
      WHEN 'pending_approval' THEN 1
      WHEN 'expired' THEN 2
      ELSE 3
    END,
    vr.created_at ASC;
END;
$function$
;

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

CREATE OR REPLACE FUNCTION public.has_pending_proposal(p_attendance_record_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.attendance_change_proposals
    WHERE attendance_record_id = p_attendance_record_id
      AND status = 'pending'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.initialize_store_settings(p_store_id uuid, p_preset text DEFAULT 'recommended'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  -- Validate preset
  IF p_preset NOT IN ('minimal', 'recommended', 'full') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid preset. Use: minimal, recommended, or full');
  END IF;

  -- Check if store exists
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = p_store_id) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Store not found');
  END IF;

  -- Delete existing settings for the store (start fresh)
  DELETE FROM public.app_settings WHERE store_id = p_store_id;

  -- ==========================================================================
  -- TICKETS CATEGORY
  -- ==========================================================================

  -- enable_ticket_approval_system (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'enable_ticket_approval_system',
    CASE WHEN p_preset IN ('minimal', 'recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Tickets',
    'Enable Ticket Approval System',
    'Tickets must be approved by management before payment collection',
    'true'::jsonb,
    true,
    true,
    'When enabled, tickets must be approved by management before payment collection.',
    10,
    '[{"key": "auto_approve_after_48_hours", "type": "affects", "label": "Auto-approve after 48 hours"}, {"key": "admin_review_rejected_tickets", "type": "affects", "label": "Admin review for rejected tickets"}]'::jsonb
  );

  -- auto_approve_after_48_hours
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'auto_approve_after_48_hours',
    CASE WHEN p_preset IN ('recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Tickets',
    'Auto-Approve After 48 Hours',
    'Automatically approve tickets after 48 hours if not manually reviewed',
    'true'::jsonb,
    false,
    'Tickets that are not manually approved or rejected within 48 hours will be automatically approved.',
    20,
    '[{"key": "enable_ticket_approval_system", "type": "requires", "label": "Enable ticket approval system"}]'::jsonb
  );

  -- admin_review_rejected_tickets
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'admin_review_rejected_tickets',
    CASE WHEN p_preset = 'full' THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Tickets',
    'Admin Review Rejected Tickets',
    'Require admin review for tickets rejected by supervisors',
    'false'::jsonb,
    'When enabled, tickets rejected by supervisors must be reviewed by an admin before final rejection.',
    30,
    '[{"key": "enable_ticket_approval_system", "type": "requires", "label": "Enable ticket approval system"}]'::jsonb
  );

  -- require_customer_name_on_tickets
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'require_customer_name_on_tickets',
    'false'::jsonb,
    'Tickets',
    'Require Customer Name',
    'Forces entry of customer name on all tickets',
    'false'::jsonb,
    'When enabled, tickets cannot be created or closed without a customer name.',
    60
  );

  -- require_customer_phone_on_tickets
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'require_customer_phone_on_tickets',
    'false'::jsonb,
    'Tickets',
    'Require Customer Phone',
    'Forces entry of customer phone number on all tickets',
    'false'::jsonb,
    'When enabled, tickets cannot be created or closed without a customer phone number.',
    70
  );

  -- require_employee_checkin_before_tickets
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'require_employee_checkin_before_tickets',
    'true'::jsonb,
    'Tickets',
    'Require Employee Check-In',
    'Employees must be checked in to be assigned tickets',
    'true'::jsonb,
    'When enabled, only employees who have checked in can be assigned to tickets.',
    80
  );

  -- enable_ticket_notes
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_ticket_notes',
    'true'::jsonb,
    'Tickets',
    'Enable Ticket Notes',
    'Allow adding notes and comments to tickets',
    'true'::jsonb,
    'When enabled, staff can add internal notes to tickets.',
    90
  );

  -- show_ticket_timer_warnings
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'show_ticket_timer_warnings',
    'true'::jsonb,
    'Tickets',
    'Show Timer Warnings',
    'Display warnings when service time exceeds expected duration',
    'true'::jsonb,
    'When enabled, tickets that exceed their expected service time will show a warning.',
    100
  );

  -- ==========================================================================
  -- PAYMENT CATEGORY
  -- ==========================================================================

  -- enable_cash_payments
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_cash_payments',
    'true'::jsonb,
    'Payment',
    'Enable Cash Payments',
    'Allow customers to pay with cash',
    'true'::jsonb,
    'When enabled, cash will be available as a payment method.',
    10
  );

  -- enable_card_payments
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_card_payments',
    'true'::jsonb,
    'Payment',
    'Enable Card Payments',
    'Allow customers to pay with credit/debit cards',
    'true'::jsonb,
    'When enabled, card will be available as a payment method.',
    20
  );

  -- enable_gift_card_payments
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_gift_card_payments',
    'true'::jsonb,
    'Payment',
    'Enable Gift Card Payments',
    'Allow customers to pay with gift cards',
    'true'::jsonb,
    'When enabled, gift card will be available as a payment method.',
    30
  );

  -- enable_mixed_payment_methods
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'enable_mixed_payment_methods',
    'true'::jsonb,
    'Payment',
    'Enable Mixed Payments',
    'Allow customers to split payment across multiple methods',
    'true'::jsonb,
    'When enabled, customers can split their payment between cash, card, and gift card.',
    40,
    '[{"key": "enable_cash_payments", "type": "requires", "label": "Enable cash payments"}, {"key": "enable_card_payments", "type": "requires", "label": "Enable card payments"}]'::jsonb
  );

  -- allow_ticket_discounts (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order)
  VALUES (
    p_store_id,
    'allow_ticket_discounts',
    'false'::jsonb,
    'Payment',
    'Allow Ticket Discounts',
    'Enable discount functionality on tickets',
    'false'::jsonb,
    true,
    'When enabled, authorized staff can apply discounts to tickets. This is a sensitive setting.',
    50
  );

  -- require_opening_cash_validation
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'require_opening_cash_validation',
    'false'::jsonb,
    'Payment',
    'Require Opening Cash Validation',
    'Validate opening cash count before allowing cash payments',
    'false'::jsonb,
    'When enabled, cash payments are blocked until the opening cash count is validated.',
    60
  );

  -- ==========================================================================
  -- EMPLOYEE CATEGORY
  -- ==========================================================================

  -- show_tip_details_to_technicians
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'show_tip_details_to_technicians',
    'true'::jsonb,
    'Employee',
    'Show Tip Details to Technicians',
    'Allow technicians to see detailed tip breakdowns',
    'true'::jsonb,
    'When enabled, technicians can view detailed tip information.',
    10
  );

  -- enable_tip_pairing_mode
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_tip_pairing_mode',
    'true'::jsonb,
    'Employee',
    'Enable Tip Pairing',
    'Allow technicians to work in pairs and share tips',
    'true'::jsonb,
    'When enabled, two technicians can be assigned to the same service and split tips.',
    20
  );

  -- show_attendance_on_home_page
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'show_attendance_on_home_page',
    'true'::jsonb,
    'Employee',
    'Show Attendance on Home',
    'Display quick attendance check-in/out on home page',
    'true'::jsonb,
    'When enabled, employees can quickly check in and out from the home page.',
    30
  );

  -- ==========================================================================
  -- OPERATIONS CATEGORY
  -- ==========================================================================

  -- enable_ready_queue
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_ready_queue',
    CASE WHEN p_preset IN ('recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Operations',
    'Enable Ready Queue',
    'Enable the technician ready queue system',
    'true'::jsonb,
    'When enabled, technicians can join a queue to indicate availability.',
    40
  );

  -- show_queue_button_in_header
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'show_queue_button_in_header',
    CASE WHEN p_preset IN ('recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Operations',
    'Show Queue Button in Header',
    'Display a quick-access queue button in the header',
    'true'::jsonb,
    'When enabled, shows a button in the header for quick access to the queue.',
    50,
    '[{"key": "enable_ready_queue", "type": "requires", "label": "Enable ready queue"}]'::jsonb
  );

  -- auto_checkout_employees_at_closing (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order)
  VALUES (
    p_store_id,
    'auto_checkout_employees_at_closing',
    CASE WHEN p_preset IN ('minimal', 'recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Operations',
    'Auto-Checkout at Closing',
    'Automatically checks out all employees at closing time',
    'true'::jsonb,
    true,
    'Automatically checks out all employees at the store closing time.',
    10
  );

  -- require_opening_cash_count (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order)
  VALUES (
    p_store_id,
    'require_opening_cash_count',
    CASE WHEN p_preset IN ('minimal', 'recommended', 'full') THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'Operations',
    'Require Opening Cash Count',
    'Requires managers to count opening cash before tickets can be created',
    'true'::jsonb,
    true,
    'Requires managers to count opening cash before any tickets can be created for the day.',
    10
  );

  -- show_opening_cash_missing_banner
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'show_opening_cash_missing_banner',
    'true'::jsonb,
    'Operations',
    'Show Opening Cash Banner',
    'Display a banner when opening cash count is missing',
    'true'::jsonb,
    'When enabled, shows a warning banner when the opening cash count has not been submitted.',
    20,
    '[{"key": "require_opening_cash_count", "type": "requires", "label": "Require opening cash count"}]'::jsonb
  );

  -- ==========================================================================
  -- NOTIFICATIONS CATEGORY
  -- ==========================================================================

  -- show_version_notifications
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'show_version_notifications',
    'true'::jsonb,
    'Notifications',
    'Show Version Updates',
    'Display banner when new app version is available',
    'true'::jsonb,
    'When enabled, a notification banner appears when a new version is available.',
    10
  );

  -- show_pending_approval_badge
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'show_pending_approval_badge',
    'true'::jsonb,
    'Notifications',
    'Show Approval Badge',
    'Display count of pending approvals in navigation',
    'true'::jsonb,
    'When enabled, shows a badge with the number of items pending approval.',
    20
  );

  -- enable_approval_deadline_warnings
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order, dependencies)
  VALUES (
    p_store_id,
    'enable_approval_deadline_warnings',
    'true'::jsonb,
    'Notifications',
    'Approval Deadline Warnings',
    'Show warnings for approvals approaching auto-approval deadline',
    'true'::jsonb,
    'When enabled, displays warnings for tickets approaching the auto-approval deadline.',
    30,
    '[{"key": "auto_approve_after_48_hours", "type": "requires", "label": "Auto-approve after 48 hours"}]'::jsonb
  );

  -- ==========================================================================
  -- SYSTEM CATEGORY
  -- ==========================================================================

  -- enable_realtime_refresh (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_realtime_refresh',
    CASE WHEN p_preset = 'full' THEN 'true'::jsonb ELSE 'false'::jsonb END,
    'System',
    'Enable Real-time Refresh',
    'Enables automatic real-time updates for data changes',
    'false'::jsonb,
    true,
    true,
    'Enables automatic real-time updates for data changes across all devices.',
    10
  );

  -- enable_inventory_module (critical)
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, requires_restart, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_inventory_module',
    'true'::jsonb,
    'System',
    'Enable Inventory Module',
    'Enables the full inventory management module',
    'true'::jsonb,
    true,
    true,
    'Enables the full inventory management module including stock tracking, distributions, and audits.',
    20
  );

  -- enable_audit_logging
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'enable_audit_logging',
    'true'::jsonb,
    'System',
    'Enable Audit Logging',
    'Track all configuration changes and critical actions',
    'true'::jsonb,
    'When enabled, all changes to settings and critical actions are logged.',
    30
  );

  -- store_timezone
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'store_timezone',
    '"America/New_York"'::jsonb,
    'System',
    'Store Timezone',
    'The timezone for this store',
    '"America/New_York"'::jsonb,
    'Set the timezone for this store. All times will be displayed in this timezone.',
    40
  );

  -- auto_approval_minutes
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order)
  VALUES (
    p_store_id,
    'auto_approval_minutes',
    '2880'::jsonb,
    'System',
    'Auto-Approval Time (Supervisor)',
    'Minutes before tickets are auto-approved for supervisors',
    '2880'::jsonb,
    true,
    'Time in minutes before tickets are automatically approved if not manually reviewed (2880 = 48 hours).',
    50
  );

  -- auto_approval_minutes_manager
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, is_critical, help_text, display_order)
  VALUES (
    p_store_id,
    'auto_approval_minutes_manager',
    '2880'::jsonb,
    'System',
    'Auto-Approval Time (Manager)',
    'Minutes before tickets are auto-approved for managers',
    '2880'::jsonb,
    true,
    'Time in minutes before tickets requiring manager approval are automatically approved (2880 = 48 hours).',
    60
  );

  -- violation_min_votes_required
  INSERT INTO public.app_settings (store_id, setting_key, setting_value, category, display_name, description, default_value, help_text, display_order)
  VALUES (
    p_store_id,
    'violation_min_votes_required',
    '3'::jsonb,
    'System',
    'Minimum Violation Votes',
    'Minimum votes required to flag a violation',
    '3'::jsonb,
    'The minimum number of votes required before a violation is flagged for review.',
    70
  );

  -- Count total settings created
  SELECT COUNT(*) INTO v_count FROM public.app_settings WHERE store_id = p_store_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Successfully initialized %s settings with %s preset', v_count, p_preset),
    'settings_count', v_count
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_technician_checked_in_any_store_today(p_employee_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_checked_in boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.attendance_records
    WHERE employee_id = p_employee_id
      AND work_date = CURRENT_DATE
      AND status = 'checked_in'
      AND check_in_time IS NOT NULL
      AND check_out_time IS NULL
  ) INTO v_checked_in;

  RETURN v_checked_in;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_technician_checked_in_today(p_employee_id uuid, p_store_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_checked_in boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.attendance_records
    WHERE employee_id = p_employee_id
      AND store_id = p_store_id
      AND work_date = CURRENT_DATE
      AND status = 'checked_in'
      AND check_in_time IS NOT NULL
      AND check_out_time IS NULL
  ) INTO v_checked_in;

  RETURN v_checked_in;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.join_ready_queue(p_employee_id uuid, p_store_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- Mark any open tickets assigned to this technician as completed
  UPDATE public.sale_tickets
  SET
    completed_at = NOW(),
    completed_by = p_employee_id,
    updated_at = NOW()
  WHERE id IN (
    SELECT DISTINCT ti.sale_ticket_id
    FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = p_employee_id
      AND st.store_id = p_store_id
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
  );

  -- Remove any existing entry for this technician in this store
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id;

  -- Add technician to ready queue
  INSERT INTO public.technician_ready_queue (
    employee_id,
    store_id,
    status,
    ready_at
  ) VALUES (
    p_employee_id,
    p_store_id,
    'ready',
    NOW()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_auto_approval_activity()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_ticket RECORD;
BEGIN
  -- Log auto-approval for tickets that were just auto-approved
  FOR v_ticket IN 
    SELECT id, ticket_no, customer_name, total
    FROM sale_tickets
    WHERE approval_status = 'auto_approved'
      AND approved_at >= now() - INTERVAL '5 minutes'
      AND approved_at IS NOT NULL
  LOOP
    -- Check if activity log entry already exists to avoid duplicates
    IF NOT EXISTS (
      SELECT 1 FROM ticket_activity_log
      WHERE ticket_id = v_ticket.id
        AND action = 'approved'
        AND description LIKE '%automatically approved%'
    ) THEN
      INSERT INTO ticket_activity_log (
        ticket_id,
        employee_id,
        action,
        description,
        changes
      ) VALUES (
        v_ticket.id,
        NULL,
        'approved',
        'Ticket automatically approved after 48-hour deadline',
        json_build_object(
          'approval_type', 'auto_approved',
          'ticket_no', v_ticket.ticket_no,
          'customer_name', v_ticket.customer_name,
          'total', v_ticket.total
        )
      );
    END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_technician_available(p_employee_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM technician_ready_queue
  WHERE employee_id = p_employee_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_technician_busy(p_employee_id uuid, p_ticket_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- Remove technician from ready queue when assigned to a ticket
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_ticket_completed(p_ticket_id uuid, p_employee_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ticket sale_tickets;
BEGIN
  -- Get the ticket
  SELECT * INTO v_ticket FROM sale_tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Ticket not found');
  END IF;

  -- Check if ticket is already closed
  IF v_ticket.closed_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'message', 'Ticket is already closed');
  END IF;

  -- Check if employee is assigned to this ticket
  IF NOT EXISTS (
    SELECT 1 FROM ticket_items WHERE sale_ticket_id = p_ticket_id AND employee_id = p_employee_id
  ) THEN
    RETURN json_build_object('success', false, 'message', 'You are not assigned to this ticket');
  END IF;

  -- Mark ticket as completed
  UPDATE sale_tickets
  SET
    completed_at = NOW(),
    completed_by = p_employee_id,
    updated_at = NOW()
  WHERE id = p_ticket_id;

  RETURN json_build_object('success', true, 'message', 'Ticket marked as completed');
END;
$function$
;

create or replace view "public"."pending_approval_debug" as  SELECT st.id,
    st.ticket_no,
    st.approval_required_level,
    st.approval_reason,
    st.performed_and_closed_by_same_person,
    st.closed_by_roles,
    e.display_name AS closer_name,
    e.role AS closer_roles_from_db,
    ( SELECT count(DISTINCT ticket_items.employee_id) AS count
           FROM public.ticket_items
          WHERE (ticket_items.sale_ticket_id = st.id)) AS performer_count,
    ( SELECT string_agg(DISTINCT emp.display_name, ', '::text) AS string_agg
           FROM (public.ticket_items ti
             JOIN public.employees emp ON ((ti.employee_id = emp.id)))
          WHERE (ti.sale_ticket_id = st.id)) AS performer_names,
    (st.closed_by IN ( SELECT DISTINCT ticket_items.employee_id
           FROM public.ticket_items
          WHERE (ticket_items.sale_ticket_id = st.id))) AS closer_is_performer
   FROM (public.sale_tickets st
     LEFT JOIN public.employees e ON ((st.closed_by = e.id)))
  WHERE ((st.approval_status = 'pending_approval'::text) AND (st.closed_at IS NOT NULL))
  ORDER BY st.ticket_date DESC;


CREATE OR REPLACE FUNCTION public.preview_historical_auto_checkout()
 RETURNS TABLE(records_to_update bigint, store_id uuid, store_name text, affected_dates text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as records_to_update,
    ar.store_id,
    s.name as store_name,
    array_agg(DISTINCT ar.date::text ORDER BY ar.date::text) as affected_dates
  FROM public.attendance_records ar
  JOIN public.stores s ON s.id = ar.store_id
  WHERE 
    s.closing_time IS NOT NULL
    AND ar.check_out_time IS NULL
    AND ar.date < CURRENT_DATE
  GROUP BY ar.store_id, s.name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.preview_historical_auto_checkout(p_start_date date DEFAULT '2000-01-01'::date, p_end_date date DEFAULT (CURRENT_DATE - '1 day'::interval))
 RETURNS TABLE(attendance_id uuid, employee_id uuid, employee_name text, store_code text, work_date date, check_in_time timestamp with time zone, proposed_checkout_time timestamp with time zone, proposed_hours numeric, checkout_source text, current_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_record RECORD;
  v_last_ticket_time timestamptz;
  v_store_closing_time timestamptz;
  v_checkout_time timestamptz;
  v_hours numeric;
  v_day_of_week text;
  v_closing_time_str text;
  v_checkout_source text;
  v_fallback_time timestamptz;
BEGIN
  -- Loop through all checked-in employees in the date range
  FOR v_record IN
    SELECT
      ar.id as attendance_id,
      ar.employee_id,
      ar.store_id,
      ar.check_in_time,
      ar.work_date,
      ar.status,
      e.display_name as employee_name,
      s.code as store_code,
      s.closing_hours
    FROM public.attendance_records ar
    JOIN public.employees e ON ar.employee_id = e.id
    JOIN public.stores s ON ar.store_id = s.id
    WHERE ar.status = 'checked_in'
      AND ar.work_date >= p_start_date
      AND ar.work_date <= p_end_date
    ORDER BY ar.work_date, ar.check_in_time
  LOOP
    -- Get day of week for this specific date
    v_day_of_week := lower(trim(to_char(v_record.work_date, 'Day')));

    -- Get the last ticket closing time for this employee on this date
    SELECT MAX(st.closed_at) INTO v_last_ticket_time
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = v_record.employee_id
      AND st.store_id = v_record.store_id
      AND st.ticket_date = v_record.work_date
      AND st.closed_at IS NOT NULL;

    -- Get store closing time for this day of week
    v_store_closing_time := NULL;
    IF v_record.closing_hours IS NOT NULL THEN
      v_closing_time_str := v_record.closing_hours->>v_day_of_week;

      IF v_closing_time_str IS NOT NULL THEN
        -- Build closing time as timestamptz in Eastern timezone
        v_store_closing_time := (
          (v_record.work_date || ' ' || v_closing_time_str)::timestamp
          AT TIME ZONE 'America/New_York'
        );
      END IF;
    END IF;

    -- Fallback time: 21:00 on the work date (for dates before closing_hours existed)
    v_fallback_time := (
      (v_record.work_date || ' 21:00:00')::timestamp
      AT TIME ZONE 'America/New_York'
    );

    -- Determine checkout time using Option C logic: GREATEST of both times
    IF v_last_ticket_time IS NOT NULL AND v_store_closing_time IS NOT NULL THEN
      -- Both times available: use whichever is LATER
      IF v_last_ticket_time > v_store_closing_time THEN
        v_checkout_time := v_last_ticket_time;
        v_checkout_source := 'late_ticket';
      ELSE
        v_checkout_time := v_store_closing_time;
        v_checkout_source := 'store_hours';
      END IF;
    ELSIF v_last_ticket_time IS NOT NULL THEN
      -- Only ticket time available
      v_checkout_time := v_last_ticket_time;
      v_checkout_source := 'ticket_only';
    ELSIF v_store_closing_time IS NOT NULL THEN
      -- Only store closing time available
      v_checkout_time := v_store_closing_time;
      v_checkout_source := 'store_hours_only';
    ELSE
      -- Neither time available - use fallback
      v_checkout_time := v_fallback_time;
      v_checkout_source := 'fallback_21:00';
    END IF;

    -- Calculate hours worked
    v_hours := EXTRACT(EPOCH FROM (v_checkout_time - v_record.check_in_time)) / 3600;

    -- Skip if hours is negative (data issue)
    IF v_hours < 0 THEN
      CONTINUE;
    END IF;

    -- Return this preview row
    attendance_id := v_record.attendance_id;
    employee_id := v_record.employee_id;
    employee_name := v_record.employee_name;
    store_code := v_record.store_code;
    work_date := v_record.work_date;
    check_in_time := v_record.check_in_time;
    proposed_checkout_time := v_checkout_time;
    proposed_hours := v_hours;
    checkout_source := v_checkout_source;
    current_status := v_record.status;

    RETURN NEXT;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_employee_inventory_summary(p_employee_id uuid, p_master_item_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_quantity numeric;
  v_total_value numeric;
  v_store_id uuid;
BEGIN
  -- Get employee's store
  SELECT es.store_id INTO v_store_id
  FROM public.employee_stores es
  WHERE es.employee_id = p_employee_id
  LIMIT 1;

  -- Calculate totals from lot-level records
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(quantity * unit_cost), 0)
  INTO v_total_quantity, v_total_value
  FROM public.employee_inventory_lots
  WHERE employee_id = p_employee_id
    AND master_item_id = p_master_item_id;

  -- Upsert employee_inventory record
  INSERT INTO public.employee_inventory (
    employee_id,
    store_id,
    master_item_id,
    quantity_on_hand,
    total_value,
    updated_at
  )
  VALUES (
    p_employee_id,
    v_store_id,
    p_master_item_id,
    v_total_quantity,
    v_total_value,
    now()
  )
  ON CONFLICT (employee_id, master_item_id)
  DO UPDATE SET
    quantity_on_hand = v_total_quantity,
    total_value = v_total_value,
    updated_at = now();

  -- Remove record if quantity is zero
  IF v_total_quantity = 0 THEN
    DELETE FROM public.employee_inventory
    WHERE employee_id = p_employee_id
      AND master_item_id = p_master_item_id;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_from_ready_queue(p_employee_id uuid, p_store_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_technician_from_queue_admin(p_employee_id uuid, p_store_id uuid, p_reason text, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_removed_by_id uuid;
  v_removed_by_role text[];
  v_queue_record_exists boolean;
  v_removal_id uuid;
BEGIN
  -- Get caller's ID and role
  SELECT id, role INTO v_removed_by_id, v_removed_by_role
  FROM public.employees
  WHERE id = auth.uid();
  
  -- Check if caller has permission
  IF v_removed_by_id IS NULL OR NOT (v_removed_by_role && ARRAY['Manager', 'Supervisor', 'Admin', 'Owner']::text[]) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You do not have permission to remove technicians from the queue'
    );
  END IF;
  
  -- Check if caller has access to this store
  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_stores
    WHERE employee_id = v_removed_by_id
      AND store_id = p_store_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'You do not have access to this store'
    );
  END IF;
  
  -- Check if technician is actually in the queue
  SELECT EXISTS (
    SELECT 1
    FROM public.technician_ready_queue
    WHERE employee_id = p_employee_id
      AND store_id = p_store_id
  ) INTO v_queue_record_exists;
  
  IF NOT v_queue_record_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Technician is not currently in the queue'
    );
  END IF;
  
  -- Validate reason
  IF p_reason NOT IN (
    'Rule violation',
    'Left work area without permission',
    'Not following queue policy',
    'Attendance policy violation',
    'Other'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid removal reason'
    );
  END IF;
  
  -- Remove from queue
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id;
  
  -- Log removal with 30-minute cooldown
  INSERT INTO public.queue_removals_log (
    employee_id,
    store_id,
    removed_by_employee_id,
    reason,
    notes,
    removed_at,
    cooldown_expires_at
  )
  VALUES (
    p_employee_id,
    p_store_id,
    v_removed_by_id,
    p_reason,
    p_notes,
    now(),
    now() + INTERVAL '30 minutes'
  )
  RETURNING id INTO v_removal_id;
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Technician removed from queue with 30-minute cooldown',
    'removal_id', v_removal_id,
    'cooldown_expires_at', now() + INTERVAL '30 minutes'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error removing technician: ' || SQLERRM
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rename_service_category(p_category_id uuid, p_store_id uuid, p_original_name text, p_new_name text, p_color text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_category_exists boolean;
  v_services_updated integer;
BEGIN
  -- Verify the category exists and belongs to the specified store
  SELECT EXISTS(
    SELECT 1 FROM store_service_categories
    WHERE id = p_category_id
    AND store_id = p_store_id
  ) INTO v_category_exists;
  
  IF NOT v_category_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Category not found or does not belong to this store'
    );
  END IF;
  
  BEGIN
    -- Update the category itself
    UPDATE store_service_categories
    SET 
      name = p_new_name,
      color = COALESCE(p_color, color),
      updated_at = now()
    WHERE id = p_category_id;
    
    -- Update all services with the old category name to the new name
    UPDATE store_services
    SET 
      category = p_new_name,
      updated_at = now()
    WHERE store_id = p_store_id
    AND category = p_original_name;
    
    GET DIAGNOSTICS v_services_updated = ROW_COUNT;
    
    RETURN jsonb_build_object(
      'success', true,
      'services_updated', v_services_updated,
      'message', 'Category renamed successfully'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
  END;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reset_role_permissions_to_default(p_store_id uuid, p_role_name text, p_employee_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Delete all custom permissions for this role (reverting to defaults)
  DELETE FROM public.role_permissions
  WHERE store_id = p_store_id AND role_name = p_role_name;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Log the reset action
  INSERT INTO public.role_permissions_audit (
    store_id,
    role_name,
    permission_key,
    old_value,
    new_value,
    changed_by,
    change_reason
  ) VALUES (
    p_store_id,
    p_role_name,
    'ALL_PERMISSIONS',
    false,
    true,
    p_employee_id,
    'Reset all permissions to default'
  );

  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.return_from_employee(p_employee_id uuid, p_master_item_id uuid, p_quantity numeric, p_returned_by_id uuid, p_notes text DEFAULT ''::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining_qty numeric;
  v_emp_lot record;
  v_return_qty numeric;
  v_store_id uuid;
  v_result json;
BEGIN
  v_remaining_qty := p_quantity;

  -- Get employee's store
  SELECT es.store_id INTO v_store_id
  FROM public.employee_stores es
  WHERE es.employee_id = p_employee_id
  LIMIT 1;

  -- Validate employee has enough inventory
  IF (SELECT COALESCE(SUM(quantity), 0)
      FROM public.employee_inventory_lots
      WHERE employee_id = p_employee_id
        AND master_item_id = p_master_item_id) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient employee inventory. Requested: %, Available: %',
      p_quantity,
      (SELECT COALESCE(SUM(quantity), 0)
       FROM public.employee_inventory_lots
       WHERE employee_id = p_employee_id
         AND master_item_id = p_master_item_id);
  END IF;

  -- Process each employee lot in FIFO order
  FOR v_emp_lot IN
    SELECT id, lot_id, quantity, unit_cost, distributed_date
    FROM public.employee_inventory_lots
    WHERE employee_id = p_employee_id
      AND master_item_id = p_master_item_id
    ORDER BY distributed_date ASC
  LOOP
    EXIT WHEN v_remaining_qty <= 0;

    -- Determine how much to return from this lot
    v_return_qty := LEAST(v_remaining_qty, v_emp_lot.quantity);

    -- Return quantity to lot
    UPDATE public.inventory_purchase_lots
    SET quantity_remaining = quantity_remaining + v_return_qty,
        status = 'active',
        updated_at = now()
    WHERE id = v_emp_lot.lot_id;

    -- Remove or update employee lot record
    IF v_return_qty >= v_emp_lot.quantity THEN
      DELETE FROM public.employee_inventory_lots WHERE id = v_emp_lot.id;
    ELSE
      UPDATE public.employee_inventory_lots
      SET quantity = quantity - v_return_qty,
          updated_at = now()
      WHERE id = v_emp_lot.id;
    END IF;

    v_remaining_qty := v_remaining_qty - v_return_qty;
  END LOOP;

  -- Update employee inventory summary
  PERFORM public.refresh_employee_inventory_summary(p_employee_id, p_master_item_id);

  -- Update store inventory stock
  UPDATE public.store_inventory_stock
  SET quantity_on_hand = quantity_on_hand + p_quantity,
      updated_at = now()
  WHERE store_id = v_store_id
    AND item_id = p_master_item_id;

  v_result := json_build_object(
    'success', true,
    'returned_quantity', p_quantity
  );

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.seed_store_permissions(p_store_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  -- No need to insert anything - defaults are handled by the get_role_permissions function
  -- This function exists for potential future use
  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.store_has_configuration(p_store_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.app_settings WHERE store_id = p_store_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_store_service_to_global(p_store_service_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_store_service record;
BEGIN
  -- Get store_service details
  SELECT * INTO v_store_service
  FROM public.store_services
  WHERE id = p_store_service_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Store service not found';
  END IF;

  -- Update global service with store_service details
  -- Only update if this is the "canonical" store (or if no conflict)
  UPDATE public.services
  SET
    name = v_store_service.name,
    category = v_store_service.category,
    updated_at = now()
  WHERE id = v_store_service.service_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_mark_technician_busy_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ticket_completed_at timestamptz;
BEGIN
  IF NEW.employee_id IS DISTINCT FROM OLD.employee_id AND NEW.employee_id IS NOT NULL THEN
    SELECT completed_at INTO v_ticket_completed_at
    FROM public.sale_tickets
    WHERE id = NEW.sale_ticket_id;

    IF v_ticket_completed_at IS NULL THEN
      PERFORM public.mark_technician_busy_smart(NEW.employee_id, NEW.sale_ticket_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_attendance_change_proposals_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_last_activity(p_employee_id uuid, p_store_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE attendance_records
  SET
    last_activity_time = now(),
    updated_at = now()
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = CURRENT_DATE
    AND status = 'checked_in'
    AND pay_type = 'daily';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_pending_ticket_deadlines(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_approval_minutes_standard integer;
  v_approval_minutes_manager integer;
  v_count_standard integer;
  v_count_manager integer;
  v_count_total integer;
BEGIN
  v_approval_minutes_standard := public.get_auto_approval_minutes_by_level(p_store_id, 'technician');
  v_approval_minutes_manager := public.get_auto_approval_minutes_by_level(p_store_id, 'manager');

  WITH updated_standard AS (
    UPDATE public.sale_tickets
    SET
      approval_deadline = closed_at + (v_approval_minutes_standard || ' minutes')::INTERVAL,
      updated_at = now()
    WHERE store_id = p_store_id
      AND approval_status = 'pending_approval'
      AND closed_at IS NOT NULL
      AND approval_required_level IN ('technician', 'supervisor')
    RETURNING id
  )
  SELECT count(*)
  INTO v_count_standard
  FROM updated_standard;

  WITH updated_manager AS (
    UPDATE public.sale_tickets
    SET
      approval_deadline = closed_at + (v_approval_minutes_manager || ' minutes')::INTERVAL,
      updated_at = now()
    WHERE store_id = p_store_id
      AND approval_status = 'pending_approval'
      AND closed_at IS NOT NULL
      AND approval_required_level = 'manager'
    RETURNING id
  )
  SELECT count(*)
  INTO v_count_manager
  FROM updated_manager;

  v_count_total := COALESCE(v_count_standard, 0) + COALESCE(v_count_manager, 0);

  RETURN jsonb_build_object(
    'success', true,
    'store_id', p_store_id,
    'updated_count_total', v_count_total,
    'updated_count_standard', COALESCE(v_count_standard, 0),
    'updated_count_manager', COALESCE(v_count_manager, 0),
    'approval_minutes_standard', v_approval_minutes_standard,
    'approval_minutes_manager', v_approval_minutes_manager,
    'message', format('Updated %s pending ticket(s) with new deadlines (%s standard, %s manager)',
      v_count_total,
      COALESCE(v_count_standard, 0),
      COALESCE(v_count_manager, 0))
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_store_stock(p_store_id uuid, p_item_id uuid, p_quantity numeric DEFAULT 0, p_cost_override numeric DEFAULT NULL::numeric, p_reorder_override numeric DEFAULT NULL::numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stock_id uuid;
BEGIN
  INSERT INTO public.store_inventory_stock (
    store_id, 
    item_id, 
    quantity_on_hand, 
    unit_cost_override, 
    reorder_level_override,
    updated_at
  )
  VALUES (
    p_store_id, 
    p_item_id, 
    p_quantity,
    p_cost_override, 
    p_reorder_override,
    now()
  )
  ON CONFLICT (store_id, item_id) DO UPDATE SET
    quantity_on_hand = public.store_inventory_stock.quantity_on_hand + EXCLUDED.quantity_on_hand,
    unit_cost_override = COALESCE(EXCLUDED.unit_cost_override, public.store_inventory_stock.unit_cost_override),
    reorder_level_override = COALESCE(EXCLUDED.reorder_level_override, public.store_inventory_stock.reorder_level_override),
    updated_at = now()
  RETURNING id INTO v_stock_id;
  
  RETURN v_stock_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_approval_status_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  -- Rule 1: If approved_by is set, status must be 'approved' (not 'auto_approved')
  IF NEW.approved_by IS NOT NULL AND NEW.approval_status = 'auto_approved' THEN
    -- Auto-correct the status
    NEW.approval_status := 'approved';
    
    -- Log a notice for debugging
    RAISE NOTICE 'Auto-corrected ticket % from auto_approved to approved (approved_by is set)', NEW.id;
  END IF;
  
  -- Rule 2: If approval_status is 'approved' but no approver, this is invalid
  IF NEW.approval_status = 'approved' AND NEW.approved_by IS NULL THEN
    -- This shouldn't happen - raise an error
    RAISE EXCEPTION 'Invalid approval state: approval_status is approved but approved_by is NULL for ticket %', NEW.id;
  END IF;
  
  -- Rule 3: If approval_status is 'auto_approved', approved_by must be NULL
  IF NEW.approval_status = 'auto_approved' AND NEW.approved_by IS NOT NULL THEN
    -- This is the inconsistency we're preventing - auto-correct it
    NEW.approval_status := 'approved';
    
    RAISE NOTICE 'Auto-corrected ticket % from auto_approved to approved (approved_by is set)', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_no_previous_unclosed_tickets()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_has_unclosed boolean;
  v_earliest_unclosed_date date;
BEGIN
  -- Check if there are any unclosed tickets before this ticket's date
  v_has_unclosed := public.check_previous_unclosed_tickets(NEW.store_id, NEW.ticket_date);
  
  IF v_has_unclosed THEN
    -- Get the earliest unclosed ticket date for a more helpful error message
    SELECT MIN(ticket_date) INTO v_earliest_unclosed_date
    FROM public.sale_tickets
    WHERE store_id = NEW.store_id
      AND ticket_date < NEW.ticket_date
      AND closed_at IS NULL;
    
    RAISE EXCEPTION 'Cannot create a new ticket for % because there are unclosed tickets from %. Please close all previous day tickets before creating new ones.',
      NEW.ticket_date,
      v_earliest_unclosed_date
    USING HINT = 'Go to the Tickets page and close all tickets from previous days first.';
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_opening_cash_before_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cash_recorded boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_cash_recorded := public.check_opening_cash_recorded(NEW.store_id, NEW.ticket_date);

    IF NOT v_cash_recorded THEN
      RAISE EXCEPTION 'Opening cash count must be recorded before creating sale tickets. Please go to End of Day page and count the opening cash first.'
        USING HINT = 'Record opening cash in the End of Day page before creating any tickets for this date.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_store_configuration(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_issues jsonb := '[]'::jsonb;
  v_settings jsonb;
  v_setting record;
BEGIN
  -- Get all settings for the store as a lookup
  SELECT jsonb_object_agg(setting_key, setting_value)
  INTO v_settings
  FROM public.app_settings
  WHERE store_id = p_store_id;

  -- If no settings, return empty issues
  IF v_settings IS NULL THEN
    RETURN jsonb_build_object('issues', '[]'::jsonb);
  END IF;

  -- Check dependency validations
  FOR v_setting IN
    SELECT setting_key, setting_value, dependencies
    FROM public.app_settings
    WHERE store_id = p_store_id
      AND dependencies IS NOT NULL
      AND jsonb_array_length(dependencies) > 0
      AND setting_value = 'true'::jsonb
  LOOP
    -- Check each dependency
    FOR i IN 0..jsonb_array_length(v_setting.dependencies) - 1 LOOP
      DECLARE
        v_dep jsonb := v_setting.dependencies->i;
        v_dep_key text := v_dep->>'key';
        v_dep_type text := v_dep->>'type';
        v_dep_label text := v_dep->>'label';
        v_dep_value jsonb;
      BEGIN
        v_dep_value := v_settings->v_dep_key;

        -- Check "requires" dependencies
        IF v_dep_type = 'requires' AND (v_dep_value IS NULL OR v_dep_value = 'false'::jsonb) THEN
          v_issues := v_issues || jsonb_build_object(
            'type', 'dependency',
            'setting', v_setting.setting_key,
            'requires', v_dep_key,
            'message', format('%s requires %s to be enabled', v_setting.setting_key, v_dep_label)
          );
        END IF;

        -- Check "conflicts" dependencies
        IF v_dep_type = 'conflicts' AND v_dep_value = 'true'::jsonb THEN
          v_issues := v_issues || jsonb_build_object(
            'type', 'conflict',
            'setting', v_setting.setting_key,
            'conflicts', v_dep_key,
            'message', format('%s conflicts with %s', v_setting.setting_key, v_dep_label)
          );
        END IF;
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('issues', v_issues);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_weekly_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  valid_days TEXT[] := ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  schedule_key TEXT;
  day_schedule JSONB;
  is_working_value JSONB;
  start_time_value JSONB;
  end_time_value JSONB;
BEGIN
  -- Allow NULL (means available all days)
  IF NEW.weekly_schedule IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check each key in the schedule
  FOR schedule_key IN SELECT jsonb_object_keys(NEW.weekly_schedule)
  LOOP
    -- Check if key is a valid day name
    IF NOT (schedule_key = ANY(valid_days)) THEN
      RAISE EXCEPTION 'Invalid day name in weekly_schedule: %. Valid days are: monday, tuesday, wednesday, thursday, friday, saturday, sunday', schedule_key;
    END IF;

    day_schedule := NEW.weekly_schedule->schedule_key;

    -- Check if value is an object
    IF jsonb_typeof(day_schedule) != 'object' THEN
      RAISE EXCEPTION 'Invalid value type for day %. Must be object with is_working, start_time, and end_time properties, got: %', schedule_key, jsonb_typeof(day_schedule);
    END IF;

    -- Check for required properties
    IF NOT (day_schedule ? 'is_working') THEN
      RAISE EXCEPTION 'Missing required property is_working for day %', schedule_key;
    END IF;

    IF NOT (day_schedule ? 'start_time') THEN
      RAISE EXCEPTION 'Missing required property start_time for day %', schedule_key;
    END IF;

    IF NOT (day_schedule ? 'end_time') THEN
      RAISE EXCEPTION 'Missing required property end_time for day %', schedule_key;
    END IF;

    -- Validate is_working is boolean
    is_working_value := day_schedule->'is_working';
    IF jsonb_typeof(is_working_value) != 'boolean' THEN
      RAISE EXCEPTION 'Invalid type for is_working in day %. Must be boolean, got: %', schedule_key, jsonb_typeof(is_working_value);
    END IF;

    -- Validate start_time is string
    start_time_value := day_schedule->'start_time';
    IF jsonb_typeof(start_time_value) != 'string' THEN
      RAISE EXCEPTION 'Invalid type for start_time in day %. Must be string, got: %', schedule_key, jsonb_typeof(start_time_value);
    END IF;

    -- Validate end_time is string
    end_time_value := day_schedule->'end_time';
    IF jsonb_typeof(end_time_value) != 'string' THEN
      RAISE EXCEPTION 'Invalid type for end_time in day %. Must be string, got: %', schedule_key, jsonb_typeof(end_time_value);
    END IF;

    -- Validate time format (HH:MM)
    IF NOT (day_schedule->>'start_time' ~ '^\d{2}:\d{2}$') THEN
      RAISE EXCEPTION 'Invalid time format for start_time in day %. Expected HH:MM format, got: %', schedule_key, day_schedule->>'start_time';
    END IF;

    IF NOT (day_schedule->>'end_time' ~ '^\d{2}:\d{2}$') THEN
      RAISE EXCEPTION 'Invalid time format for end_time in day %. Expected HH:MM format, got: %', schedule_key, day_schedule->>'end_time';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_weekly_schedule(schedule jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Check if schedule is an object
  IF jsonb_typeof(schedule) != 'object' THEN
    RETURN false;
  END IF;

  -- Check that all days are present and are objects with 'enabled' property
  IF NOT (
    schedule ? 'monday' AND jsonb_typeof(schedule->'monday') = 'object' AND
    schedule->'monday' ? 'enabled' AND jsonb_typeof(schedule->'monday'->'enabled') = 'boolean' AND
    
    schedule ? 'tuesday' AND jsonb_typeof(schedule->'tuesday') = 'object' AND
    schedule->'tuesday' ? 'enabled' AND jsonb_typeof(schedule->'tuesday'->'enabled') = 'boolean' AND
    
    schedule ? 'wednesday' AND jsonb_typeof(schedule->'wednesday') = 'object' AND
    schedule->'wednesday' ? 'enabled' AND jsonb_typeof(schedule->'wednesday'->'enabled') = 'boolean' AND
    
    schedule ? 'thursday' AND jsonb_typeof(schedule->'thursday') = 'object' AND
    schedule->'thursday' ? 'enabled' AND jsonb_typeof(schedule->'thursday'->'enabled') = 'boolean' AND
    
    schedule ? 'friday' AND jsonb_typeof(schedule->'friday') = 'object' AND
    schedule->'friday' ? 'enabled' AND jsonb_typeof(schedule->'friday'->'enabled') = 'boolean' AND
    
    schedule ? 'saturday' AND jsonb_typeof(schedule->'saturday') = 'object' AND
    schedule->'saturday' ? 'enabled' AND jsonb_typeof(schedule->'saturday'->'enabled') = 'boolean' AND
    
    schedule ? 'sunday' AND jsonb_typeof(schedule->'sunday') = 'object' AND
    schedule->'sunday' ? 'enabled' AND jsonb_typeof(schedule->'sunday'->'enabled') = 'boolean'
  ) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_approval_corrections()
 RETURNS TABLE(ticket_id uuid, approval_status text, requires_higher_approval boolean, is_consistent boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    st.id as ticket_id,
    st.approval_status,
    st.requires_higher_approval,
    CASE 
      WHEN st.requires_higher_approval = false AND st.approval_status = 'auto_approved' THEN true
      WHEN st.requires_higher_approval = true AND st.approval_status = 'manually_approved' THEN true
      ELSE false
    END as is_consistent
  FROM public.sale_tickets st
  WHERE st.status IN ('completed', 'closed');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_employee_pin(emp_id uuid, pin_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_pin_hash text;
  v_employee record;
BEGIN
  -- Get employee data
  SELECT 
    id,
    display_name,
    role,
    role_permission,
    pin_code_hash,
    status
  INTO v_employee
  FROM employees
  WHERE id = emp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Employee not found'
    );
  END IF;

  IF v_employee.status != 'Active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Employee is not active'
    );
  END IF;

  -- Verify PIN
  IF v_employee.pin_code_hash IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No PIN set for this employee'
    );
  END IF;

  IF v_employee.pin_code_hash != extensions.crypt(pin_code, v_employee.pin_code_hash) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid PIN'
    );
  END IF;

  -- Return success with employee data
  RETURN jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_employee.id,
      'display_name', v_employee.display_name,
      'role', v_employee.role,
      'role_permission', v_employee.role_permission
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_employee_pin_by_id(emp_id uuid, pin_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_pin_hash text;
  v_employee record;
BEGIN
  -- Get employee data
  SELECT 
    id,
    display_name,
    role,
    role_permission,
    pin_code_hash,
    status
  INTO v_employee
  FROM employees
  WHERE id = emp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Employee not found'
    );
  END IF;

  IF v_employee.status != 'Active' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Employee is not active'
    );
  END IF;

  -- Verify PIN
  IF v_employee.pin_code_hash IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No PIN set for this employee'
    );
  END IF;

  IF v_employee.pin_code_hash != extensions.crypt(pin_code, v_employee.pin_code_hash) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid PIN'
    );
  END IF;

  -- Return success with employee data
  RETURN jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_employee.id,
      'display_name', v_employee.display_name,
      'role', v_employee.role,
      'role_permission', v_employee.role_permission
    )
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.adjust_store_stock(p_store_id uuid, p_item_id uuid, p_quantity_change numeric, p_allow_negative boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_quantity numeric;
  v_new_quantity numeric;
BEGIN
  -- Get current quantity (create record if doesn't exist)
  SELECT quantity_on_hand INTO v_current_quantity
  FROM public.store_inventory_stock
  WHERE store_id = p_store_id AND item_id = p_item_id;
  
  IF NOT FOUND THEN
    -- Create new stock record with 0 quantity
    INSERT INTO public.store_inventory_stock (store_id, item_id, quantity_on_hand)
    VALUES (p_store_id, p_item_id, 0)
    RETURNING quantity_on_hand INTO v_current_quantity;
  END IF;
  
  v_new_quantity := v_current_quantity + p_quantity_change;
  
  -- Check if quantity would go negative
  IF v_new_quantity < 0 AND NOT p_allow_negative THEN
    RAISE EXCEPTION 'Insufficient stock. Current: %, Requested: %', v_current_quantity, ABS(p_quantity_change);
  END IF;
  
  -- Update quantity
  UPDATE public.store_inventory_stock
  SET quantity_on_hand = v_new_quantity,
      updated_at = now()
  WHERE store_id = p_store_id AND item_id = p_item_id;
  
  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_cash_transaction_change_proposal(p_proposal_id uuid, p_reviewer_employee_id uuid, p_review_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposal RECORD;
  v_reviewer RECORD;
BEGIN
  -- Validate reviewer exists and is Owner, Admin, or Manager
  SELECT * INTO v_reviewer
  FROM public.employees
  WHERE id = p_reviewer_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found');
  END IF;

  -- Check role array instead of removed role_permission column
  IF NOT ('Owner' = ANY(v_reviewer.role) OR 'Admin' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Owners or Admins can approve change proposals');
  END IF;

  -- Get the proposal
  SELECT * INTO v_proposal
  FROM public.cash_transaction_change_proposals
  WHERE id = p_proposal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal not found');
  END IF;

  IF v_proposal.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal has already been reviewed');
  END IF;

  -- Handle deletion request
  IF v_proposal.is_deletion_request THEN
    -- Delete the transaction
    DELETE FROM public.cash_transactions
    WHERE id = v_proposal.cash_transaction_id;
  ELSE
    -- Update the transaction with proposed values
    UPDATE public.cash_transactions
    SET
      amount = COALESCE(v_proposal.proposed_amount, amount),
      category = COALESCE(v_proposal.proposed_category, category),
      description = COALESCE(v_proposal.proposed_description, description),
      date = COALESCE(v_proposal.proposed_date, date),
      last_edited_by_id = p_reviewer_employee_id,
      last_edited_at = now(),
      updated_at = now()
    WHERE id = v_proposal.cash_transaction_id;
  END IF;

  -- Update the proposal status
  UPDATE public.cash_transaction_change_proposals
  SET
    status = 'approved',
    reviewed_by_employee_id = p_reviewer_employee_id,
    reviewed_at = now(),
    review_comment = NULLIF(trim(COALESCE(p_review_comment, '')), '')
  WHERE id = p_proposal_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE WHEN v_proposal.is_deletion_request
      THEN 'Transaction deleted successfully'
      ELSE 'Transaction updated successfully'
    END
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_ticket(p_ticket_id uuid, p_employee_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ticket sale_tickets;
  v_approver_roles text[];
  v_is_technician boolean;
  v_is_spa_expert boolean;
  v_is_supervisor boolean;
  v_is_manager boolean;
  v_is_owner boolean;
  v_worked_on_ticket boolean;
BEGIN
  -- Get the ticket
  SELECT * INTO v_ticket FROM sale_tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Ticket not found');
  END IF;

  -- Check if ticket is in pending_approval status
  IF v_ticket.approval_status != 'pending_approval' THEN
    RETURN json_build_object('success', false, 'message', 'Ticket is not pending approval');
  END IF;

  -- Check if approver is different from closer (NEVER allow closer to approve)
  IF v_ticket.closed_by = p_employee_id THEN
    RETURN json_build_object('success', false, 'message', 'You cannot approve a ticket you closed');
  END IF;

  -- Get approver's roles
  SELECT role INTO v_approver_roles FROM employees WHERE id = p_employee_id;

  IF v_approver_roles IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Approver not found');
  END IF;

  -- Check approver's role levels
  v_is_technician := 'Technician' = ANY(v_approver_roles);
  v_is_spa_expert := 'Spa Expert' = ANY(v_approver_roles);
  v_is_supervisor := 'Supervisor' = ANY(v_approver_roles);
  v_is_manager := 'Manager' = ANY(v_approver_roles);
  v_is_owner := 'Owner' = ANY(v_approver_roles);

  -- Check if approver worked on this ticket
  v_worked_on_ticket := EXISTS (
    SELECT 1 FROM ticket_items
    WHERE sale_ticket_id = p_ticket_id AND employee_id = p_employee_id
  );

  -- Apply approval rules based on required level
  CASE v_ticket.approval_required_level

    -- MANAGER/OWNER LEVEL REQUIRED (Supervisor performed AND closed themselves)
    WHEN 'manager' THEN
      IF NOT (v_is_manager OR v_is_owner) THEN
        RETURN json_build_object(
          'success', false,
          'message', format('This ticket requires Manager or Owner approval. Reason: %s', v_ticket.approval_reason)
        );
      END IF;

    -- SUPERVISOR LEVEL REQUIRED (Supervisor performed, Receptionist closed)
    WHEN 'supervisor' THEN
      -- Supervisor must have performed the work to approve
      IF v_is_supervisor THEN
        IF NOT v_worked_on_ticket THEN
          RETURN json_build_object(
            'success', false,
            'message', 'Supervisors can only approve tickets where they performed the service'
          );
        END IF;
      -- Or higher level (Manager/Owner) can also approve
      ELSIF NOT (v_is_manager OR v_is_owner) THEN
        RETURN json_build_object(
          'success', false,
          'message', format('This ticket requires Supervisor or higher approval. Reason: %s', v_ticket.approval_reason)
        );
      END IF;

    -- TECHNICIAN LEVEL REQUIRED (standard peer approval)
    WHEN 'technician' THEN
      -- Technician/Spa Expert must have worked on the ticket
      IF v_is_technician OR v_is_spa_expert THEN
        IF NOT v_worked_on_ticket THEN
          RETURN json_build_object(
            'success', false,
            'message', 'You must have worked on this ticket to approve it'
          );
        END IF;
      -- Or higher level (Supervisor/Manager/Owner) can also approve
      ELSIF NOT (v_is_supervisor OR v_is_manager OR v_is_owner) THEN
        RETURN json_build_object(
          'success', false,
          'message', 'You do not have permission to approve tickets'
        );
      END IF;

    ELSE
      RETURN json_build_object('success', false, 'message', 'Invalid approval level configuration');
  END CASE;

  -- Additional safety check: If performer and closer are the same person, they cannot approve
  -- (This should already be prevented by closed_by check, but double-check)
  IF v_ticket.performed_and_closed_by_same_person AND v_worked_on_ticket THEN
    -- Management can still approve these cases
    IF NOT (v_is_manager OR v_is_owner) THEN
      RETURN json_build_object(
        'success', false,
        'message', 'You cannot approve this ticket because you both performed the service and closed it'
      );
    END IF;
  END IF;

  -- Approve the ticket
  UPDATE sale_tickets
  SET
    approval_status = 'approved',
    approved_at = NOW(),
    approved_by = p_employee_id,
    updated_at = NOW()
  WHERE id = p_ticket_id;

  RETURN json_build_object('success', true, 'message', 'Ticket approved successfully');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_approve_expired_tickets()
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_count integer;
BEGIN
  -- Auto-approve tickets past their deadline
  -- BUT ONLY if they haven't been manually approved already
  UPDATE public.sale_tickets
  SET 
    approval_status = 'auto_approved',
    approved_at = now(),
    updated_at = now()
  WHERE approval_status = 'pending_approval'
    AND approval_deadline < now()
    AND approved_by IS NULL;  -- Critical: don't overwrite manual approvals
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true, 
    'message', format('Auto-approved %s ticket(s)', v_count),
    'count', v_count
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_approve_inventory_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'pending' THEN
    IF (NOT NEW.requires_manager_approval OR NEW.manager_approved)
       AND (NOT NEW.requires_recipient_approval OR NEW.recipient_approved) THEN
      NEW.status := 'approved';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_checkout_employees_by_context()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_record RECORD;
  v_last_ticket_time timestamptz;
  v_store_closing_time timestamptz;
  v_checkout_time timestamptz;
  v_hours numeric;
  v_eastern_time timestamptz;
  v_eastern_date date;
  v_day_of_week text;
  v_closing_time_str text;
  v_checkout_source text;
  v_note_addition text;
  v_use_last_ticket boolean;
BEGIN
  -- Get current date in Eastern timezone
  v_eastern_time := now() AT TIME ZONE 'America/New_York';
  v_eastern_date := v_eastern_time::date;

  -- Get day of week (lowercase, trimmed)
  v_day_of_week := lower(trim(to_char(v_eastern_time, 'Day')));

  -- Loop through all checked-in employees for today
  -- Now joining employees table to get role and pay_type
  FOR v_record IN
    SELECT
      ar.id as attendance_id,
      ar.employee_id,
      ar.store_id,
      ar.check_in_time,
      ar.work_date,
      ar.notes,
      s.closing_hours,
      e.role as employee_role,
      e.pay_type as employee_pay_type
    FROM public.attendance_records ar
    JOIN public.stores s ON ar.store_id = s.id
    JOIN public.employees e ON ar.employee_id = e.id
    WHERE ar.status = 'checked_in'
      AND ar.work_date = v_eastern_date
  LOOP
    -- Get the last ticket closing time for this employee today
    SELECT MAX(st.closed_at) INTO v_last_ticket_time
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = v_record.employee_id
      AND st.store_id = v_record.store_id
      AND st.ticket_date = v_record.work_date
      AND st.closed_at IS NOT NULL;

    -- Get store closing time for today's day of week
    v_store_closing_time := NULL;
    IF v_record.closing_hours IS NOT NULL THEN
      v_closing_time_str := v_record.closing_hours->>v_day_of_week;

      IF v_closing_time_str IS NOT NULL THEN
        -- Build closing time as timestamptz in Eastern timezone
        v_store_closing_time := (
          (v_record.work_date || ' ' || v_closing_time_str)::timestamp
          AT TIME ZONE 'America/New_York'
        );
      END IF;
    END IF;

    -- Determine if employee should checkout at last ticket time
    -- Commission OR Daily Technician/Supervisor/Manager -> use last ticket time
    v_use_last_ticket := (
      v_record.employee_pay_type = 'commission'
      OR (
        v_record.employee_pay_type = 'daily'
        AND (
          v_record.employee_role @> ARRAY['Technician']::text[]
          OR v_record.employee_role @> ARRAY['Supervisor']::text[]
          OR v_record.employee_role @> ARRAY['Manager']::text[]
        )
      )
    );

    -- Apply role-based checkout logic
    IF v_use_last_ticket THEN
      -- Commission/Daily Technician/Supervisor/Manager: Use last ticket closing time
      IF v_last_ticket_time IS NOT NULL THEN
        v_checkout_time := v_last_ticket_time;
        v_checkout_source := 'last_ticket';
      ELSIF v_store_closing_time IS NOT NULL THEN
        -- Fallback to store closing time if no tickets
        v_checkout_time := v_store_closing_time;
        v_checkout_source := 'no_ticket_store_close';
      ELSE
        -- Ultimate fallback to now()
        v_checkout_time := now();
        v_checkout_source := 'fallback_now';
        RAISE NOTICE 'Using fallback checkout for employee_id=%, attendance_id=%',
                     v_record.employee_id, v_record.attendance_id;
      END IF;

    ELSIF v_record.employee_pay_type = 'daily'
          AND v_record.employee_role @> ARRAY['Receptionist']::text[] THEN
      -- Daily Receptionist: Use store closing time
      IF v_store_closing_time IS NOT NULL THEN
        v_checkout_time := v_store_closing_time;
        v_checkout_source := 'store_close';
      ELSE
        -- Fallback to now() if no store closing time
        v_checkout_time := now();
        v_checkout_source := 'fallback_now';
        RAISE NOTICE 'Using fallback checkout for receptionist employee_id=%, attendance_id=%',
                     v_record.employee_id, v_record.attendance_id;
      END IF;

    ELSE
      -- Others (hourly, etc.): Keep existing GREATEST logic
      IF v_last_ticket_time IS NOT NULL AND v_store_closing_time IS NOT NULL THEN
        -- Both times available: use whichever is LATER
        IF v_last_ticket_time > v_store_closing_time THEN
          v_checkout_time := v_last_ticket_time;
          v_checkout_source := 'late_ticket';
        ELSE
          v_checkout_time := v_store_closing_time;
          v_checkout_source := 'store_hours';
        END IF;
      ELSIF v_last_ticket_time IS NOT NULL THEN
        -- Only ticket time available
        v_checkout_time := v_last_ticket_time;
        v_checkout_source := 'ticket_only';
      ELSIF v_store_closing_time IS NOT NULL THEN
        -- Only store closing time available
        v_checkout_time := v_store_closing_time;
        v_checkout_source := 'store_hours_only';
      ELSE
        -- FALLBACK: Use current time if nothing else available
        v_checkout_time := now();
        v_checkout_source := 'fallback_now';
        RAISE NOTICE 'Using fallback checkout for employee_id=%, attendance_id=%',
                     v_record.employee_id, v_record.attendance_id;
      END IF;
    END IF;

    -- Calculate hours worked
    v_hours := EXTRACT(EPOCH FROM (v_checkout_time - v_record.check_in_time)) / 3600;

    -- Validate hours is not negative
    IF v_hours < 0 THEN
      -- Log error and skip
      RAISE WARNING 'Negative hours for attendance_id %, skipping', v_record.attendance_id;
      CONTINUE;
    END IF;

    -- Build note addition
    v_note_addition := ' [Auto: ' || v_checkout_source || ']';

    -- Update attendance record
    UPDATE public.attendance_records
    SET
      check_out_time = v_checkout_time,
      total_hours = v_hours,
      status = 'auto_checked_out',
      notes = COALESCE(notes, '') || v_note_addition,
      updated_at = now()
    WHERE id = v_record.attendance_id;

  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.backfill_safe_balance_snapshots(p_store_id uuid, p_start_date date, p_end_date date, p_employee_id uuid)
 RETURNS TABLE(date date, success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_date date;
  v_snapshot_result RECORD;
BEGIN
  v_current_date := p_start_date;

  WHILE v_current_date <= p_end_date LOOP
    BEGIN
      -- Save snapshot for the current date
      SELECT * INTO v_snapshot_result
      FROM public.save_safe_balance_snapshot(p_store_id, v_current_date, p_employee_id)
      LIMIT 1;

      RETURN QUERY SELECT v_current_date, true, 'Snapshot created successfully'::text;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_current_date, false, SQLERRM::text;
    END;

    v_current_date := v_current_date + 1;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.bulk_update_role_permissions(p_store_id uuid, p_role_name text, p_permissions jsonb, p_employee_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
  v_permission jsonb;
BEGIN
  -- Iterate through permissions array
  FOR v_permission IN SELECT * FROM jsonb_array_elements(p_permissions)
  LOOP
    -- Update each permission
    PERFORM public.update_role_permission(
      p_store_id,
      p_role_name,
      v_permission->>'permission_key',
      (v_permission->>'is_enabled')::boolean,
      p_employee_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_ticket_total(p_ticket_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM((qty * price_each) + COALESCE(addon_price, 0)), 0)
  INTO v_total
  FROM public.ticket_items
  WHERE sale_ticket_id = p_ticket_id;

  RETURN v_total;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.change_employee_pin(emp_id uuid, old_pin text, new_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_hash text;
BEGIN
  -- Validate new PIN format
  IF new_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'New PIN must be exactly 4 digits');
  END IF;

  -- Check if old and new PINs are the same
  IF old_pin = new_pin THEN
    RETURN jsonb_build_object('success', false, 'error', 'New PIN must be different from old PIN');
  END IF;

  -- Check if new PIN is already in use by another employee
  IF public.is_pin_in_use(new_pin, emp_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This PIN is already in use by another employee. Please choose a different PIN.');
  END IF;

  -- Get current PIN hash
  SELECT pin_code_hash INTO current_hash
  FROM public.employees
  WHERE id = emp_id;

  IF current_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Verify old PIN (FIXED: added extensions. prefix)
  IF current_hash != extensions.crypt(old_pin, current_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current PIN is incorrect');
  END IF;

  -- Update with new PIN (FIXED: added extensions. prefix to both crypt and gen_salt)
  UPDATE public.employees
  SET
    pin_code_hash = extensions.crypt(new_pin, extensions.gen_salt('bf')),
    pin_temp = null,
    last_pin_change = now(),
    updated_at = now()
  WHERE id = emp_id;

  RETURN jsonb_build_object('success', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_employee_store_access(p_employee_id uuid, p_store_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_assigned_stores_count integer;
  v_has_access boolean;
BEGIN
  -- Check if employee has any store assignments
  SELECT COUNT(*)
  INTO v_assigned_stores_count
  FROM public.employee_stores
  WHERE employee_id = p_employee_id;

  -- If employee has no assignments, they can access any store (legacy/admin behavior)
  IF v_assigned_stores_count = 0 THEN
    RETURN true;
  END IF;

  -- Check if employee is assigned to the specific store
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_stores
    WHERE employee_id = p_employee_id
      AND store_id = p_store_id
  )
  INTO v_has_access;

  RETURN v_has_access;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_in_employee(p_employee_id uuid, p_store_id uuid, p_pay_type text DEFAULT 'hourly'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_record_id uuid;
  v_work_date date;
  v_check_in_time timestamptz;
  v_store_timezone text;
  v_current_time time;
  v_checkin_allowed_time time := '08:45:00'::time;
  v_has_attendance_display boolean;
  v_employee_pay_type text;
  v_other_store_record RECORD;
  v_hours_worked numeric;
BEGIN
  -- Get store timezone
  v_store_timezone := public.get_store_timezone(p_store_id);

  -- Get current date and time in store's timezone
  v_work_date := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::date;
  v_check_in_time := CURRENT_TIMESTAMP;
  v_current_time := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::time;

  -- Validate check-in is at or after 8:45 AM in store timezone
  IF v_current_time < v_checkin_allowed_time THEN
    RAISE EXCEPTION 'Check-in is available starting at 8:45 AM EST daily';
  END IF;

  -- Get employee details
  SELECT
    COALESCE(attendance_display, true),
    pay_type
  INTO
    v_has_attendance_display,
    v_employee_pay_type
  FROM public.employees
  WHERE id = p_employee_id;

  -- ALL PAY TYPES ARE ALLOWED (hourly, daily, commission)
  -- No commission blocking here!

  -- Block employees with attendance_display disabled
  IF NOT v_has_attendance_display THEN
    RAISE EXCEPTION 'Employee is not enabled for attendance tracking';
  END IF;

  -- Check if already checked in at THIS store today
  SELECT id INTO v_record_id
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = v_work_date
    AND status = 'checked_in'
    AND check_out_time IS NULL
  ORDER BY check_in_time DESC
  LIMIT 1;

  -- If already checked in at this store, return existing record (idempotent)
  IF v_record_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'work_date', v_work_date,
      'check_in_time', v_check_in_time,
      'already_checked_in', true,
      'record_id', v_record_id
    );
  END IF;

  -- Auto check-out from ANY OTHER store if currently checked in
  FOR v_other_store_record IN
    SELECT id, store_id, check_in_time, work_date
    FROM public.attendance_records
    WHERE employee_id = p_employee_id
      AND store_id != p_store_id
      AND status = 'checked_in'
      AND check_out_time IS NULL
  LOOP
    v_hours_worked := EXTRACT(EPOCH FROM (v_check_in_time - v_other_store_record.check_in_time)) / 3600;

    UPDATE public.attendance_records
    SET
      check_out_time = v_check_in_time,
      status = 'auto_checked_out',
      total_hours = v_hours_worked,
      updated_at = v_check_in_time,
      notes = COALESCE(notes || ' ', '') ||
              'Auto checked-out due to check-in at another store at ' ||
              to_char(v_check_in_time AT TIME ZONE v_store_timezone, 'HH24:MI')
    WHERE id = v_other_store_record.id;
  END LOOP;

  -- Insert new attendance record
  INSERT INTO public.attendance_records (
    employee_id,
    store_id,
    work_date,
    check_in_time,
    last_activity_time,
    status,
    pay_type
  )
  VALUES (
    p_employee_id,
    p_store_id,
    v_work_date,
    v_check_in_time,
    v_check_in_time,
    'checked_in',
    COALESCE(p_pay_type, v_employee_pay_type, 'hourly')
  )
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object(
    'success', true,
    'work_date', v_work_date,
    'check_in_time', v_check_in_time,
    'already_checked_in', false,
    'record_id', v_record_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_out_employee(p_employee_id uuid, p_store_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_check_in_time timestamptz;
  v_hours numeric;
  v_record_id uuid;
  v_work_date date;
  v_store_timezone text;
  v_has_attendance_display boolean;
BEGIN
  -- Get store timezone
  v_store_timezone := public.get_store_timezone(p_store_id);
  v_work_date := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::date;

  -- Get employee attendance_display setting
  SELECT COALESCE(attendance_display, true)
  INTO v_has_attendance_display
  FROM public.employees
  WHERE id = p_employee_id;

  -- ALL PAY TYPES ARE ALLOWED (hourly, daily, commission)
  -- No commission blocking here!

  -- Block employees with attendance_display disabled
  IF NOT v_has_attendance_display THEN
    RAISE EXCEPTION 'Employee is not enabled for attendance tracking';
  END IF;

  -- Get the most recent checked-in record without checkout
  SELECT id, check_in_time
  INTO v_record_id, v_check_in_time
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = v_work_date
    AND status = 'checked_in'
    AND check_out_time IS NULL
  ORDER BY check_in_time DESC
  LIMIT 1;

  IF v_check_in_time IS NULL THEN
    RETURN false;
  END IF;

  -- Calculate hours worked
  v_hours := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_check_in_time)) / 3600;

  -- Update attendance record
  UPDATE public.attendance_records
  SET
    check_out_time = CURRENT_TIMESTAMP,
    status = 'checked_out',
    total_hours = v_hours,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = v_record_id;

  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_queue_status(p_employee_id uuid, p_store_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_in_queue boolean;
  v_position integer;
  v_total integer;
  v_ready_at timestamptz;
BEGIN
  -- Check if employee is in queue and get their ready_at time
  SELECT
    EXISTS(
      SELECT 1
      FROM public.technician_ready_queue
      WHERE employee_id = p_employee_id
        AND store_id = p_store_id
        AND status = 'ready'
    ),
    ready_at
  INTO v_in_queue, v_ready_at
  FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND status = 'ready';

  IF v_in_queue THEN
    -- Calculate position (count how many people joined before this employee)
    SELECT COUNT(*) + 1
    INTO v_position
    FROM public.technician_ready_queue
    WHERE store_id = p_store_id
      AND status = 'ready'
      AND ready_at < v_ready_at;

    -- Get total count of ready employees in this store
    SELECT COUNT(*)
    INTO v_total
    FROM public.technician_ready_queue
    WHERE store_id = p_store_id
      AND status = 'ready';
  ELSE
    v_position := 0;
    v_total := 0;
  END IF;

  RETURN json_build_object(
    'in_queue', v_in_queue,
    'position', v_position,
    'total', v_total
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_ticket_all_services_completed(p_ticket_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_incomplete_count int;
BEGIN
  SELECT COUNT(*)
  INTO v_incomplete_count
  FROM ticket_items
  WHERE sale_ticket_id = p_ticket_id
    AND completed_at IS NULL;
  
  RETURN v_incomplete_count = 0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_cash_transaction_change_proposal(p_cash_transaction_id uuid, p_proposed_amount numeric DEFAULT NULL::numeric, p_proposed_category text DEFAULT NULL::text, p_proposed_description text DEFAULT NULL::text, p_proposed_date date DEFAULT NULL::date, p_is_deletion_request boolean DEFAULT false, p_reason_comment text DEFAULT NULL::text, p_created_by_employee_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction RECORD;
  v_employee RECORD;
  v_proposal_id uuid;
BEGIN
  -- Validate reason is provided
  IF p_reason_comment IS NULL OR trim(p_reason_comment) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reason is required');
  END IF;

  -- Validate at least one change or deletion
  IF NOT p_is_deletion_request AND
     p_proposed_amount IS NULL AND
     p_proposed_category IS NULL AND
     p_proposed_description IS NULL AND
     p_proposed_date IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least one change or deletion is required');
  END IF;

  -- Validate creator employee exists and has appropriate role
  SELECT * INTO v_employee
  FROM public.employees
  WHERE id = p_created_by_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  -- Allow Admin, Manager, or Owner to create change proposals
  IF NOT ('Manager' = ANY(v_employee.role) OR 'Admin' = ANY(v_employee.role) OR 'Owner' = ANY(v_employee.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Managers, Admins, and Owners can create change proposals');
  END IF;

  -- Validate transaction exists and is approved
  SELECT * INTO v_transaction
  FROM public.cash_transactions
  WHERE id = p_cash_transaction_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  IF v_transaction.status != 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only request changes to approved transactions');
  END IF;

  -- Check for existing pending proposal
  IF public.has_pending_cash_transaction_change_proposal(p_cash_transaction_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A pending change request already exists for this transaction');
  END IF;

  -- Create the proposal
  INSERT INTO public.cash_transaction_change_proposals (
    cash_transaction_id,
    store_id,
    current_amount,
    current_category,
    current_description,
    "current_date",
    proposed_amount,
    proposed_category,
    proposed_description,
    proposed_date,
    is_deletion_request,
    reason_comment,
    created_by_employee_id
  )
  VALUES (
    p_cash_transaction_id,
    v_transaction.store_id,
    v_transaction.amount,
    v_transaction.category,
    v_transaction.description,
    v_transaction.date,
    p_proposed_amount,
    p_proposed_category,
    p_proposed_description,
    p_proposed_date,
    p_is_deletion_request,
    trim(p_reason_comment),
    p_created_by_employee_id
  )
  RETURNING id INTO v_proposal_id;

  RETURN jsonb_build_object(
    'success', true,
    'proposal_id', v_proposal_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_cash_transaction_with_validation(p_store_id uuid, p_date date, p_transaction_type text, p_amount numeric, p_description text, p_category text, p_created_by_id uuid, p_bill_100 integer DEFAULT 0, p_bill_50 integer DEFAULT 0, p_bill_20 integer DEFAULT 0, p_bill_10 integer DEFAULT 0, p_bill_5 integer DEFAULT 0, p_bill_2 integer DEFAULT 0, p_bill_1 integer DEFAULT 0, p_coin_25 integer DEFAULT 0, p_coin_10 integer DEFAULT 0, p_coin_5 integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_access boolean;
  v_transaction_id uuid;
  v_employee_name text;
  v_store_name text;
BEGIN
  -- Validate employee has access to the store
  v_has_access := public.check_employee_store_access(p_created_by_id, p_store_id);

  IF NOT v_has_access THEN
    -- Get employee and store names for error message
    SELECT display_name INTO v_employee_name
    FROM public.employees
    WHERE id = p_created_by_id;

    SELECT name INTO v_store_name
    FROM public.stores
    WHERE id = p_store_id;

    -- Log the unauthorized attempt
    RAISE WARNING 'Unauthorized cross-store transaction attempt: Employee % (%) tried to create transaction for store % (%)',
      v_employee_name, p_created_by_id, v_store_name, p_store_id;

    RETURN json_build_object(
      'success', false,
      'error', 'Access denied: You do not have permission to create transactions for this store',
      'error_code', 'STORE_ACCESS_DENIED'
    );
  END IF;

  -- Create the transaction with denominations
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    amount,
    description,
    category,
    created_by_id,
    status,
    requires_manager_approval,
    created_at,
    bill_100,
    bill_50,
    bill_20,
    bill_10,
    bill_5,
    bill_2,
    bill_1,
    coin_25,
    coin_10,
    coin_5
  ) VALUES (
    p_store_id,
    p_date,
    p_transaction_type,
    p_amount,
    p_description,
    p_category,
    p_created_by_id,
    'pending_approval',
    true,
    now(),
    p_bill_100,
    p_bill_50,
    p_bill_20,
    p_bill_10,
    p_bill_5,
    p_bill_2,
    p_bill_1,
    p_coin_25,
    p_coin_10,
    p_coin_5
  )
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_headquarter_deposit_transfer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hq_store_id uuid;
  v_source_store_name text;
BEGIN
  -- Only process Headquarter Deposit withdrawals
  IF NEW.transaction_type != 'cash_payout' OR NEW.category != 'Headquarter Deposit' THEN
    RETURN NEW;
  END IF;

  -- Get the headquarters store ID
  SELECT id INTO v_hq_store_id
  FROM public.stores
  WHERE is_headquarters = true
  LIMIT 1;

  -- If no headquarters store found, skip
  IF v_hq_store_id IS NULL THEN
    RAISE WARNING 'No headquarters store found. Skipping auto-deposit creation.';
    RETURN NEW;
  END IF;

  -- Don't create deposit if source store IS the headquarters
  IF NEW.store_id = v_hq_store_id THEN
    RETURN NEW;
  END IF;

  -- Get the source store name for the description
  SELECT name INTO v_source_store_name
  FROM public.stores
  WHERE id = NEW.store_id;

  -- Create the deposit transaction in headquarters
  -- Using 'hq_deposit' type so it skips EOD and goes directly to Safe Balance
  INSERT INTO public.cash_transactions (
    store_id,
    date,
    transaction_type,
    amount,
    description,
    category,
    created_by_id,
    status,
    requires_manager_approval,
    manager_approved,
    manager_approved_by_id,
    manager_approved_at
  ) VALUES (
    v_hq_store_id,
    NEW.date,
    'hq_deposit',  -- Changed from 'cash_out' to skip EOD page
    NEW.amount,
    'HQ Deposit from ' || COALESCE(v_source_store_name, 'Unknown Store'),
    'Safe Deposit',
    NEW.created_by_id,
    'approved',  -- Auto-approved
    false,       -- No manager approval required
    true,        -- Already approved
    NEW.created_by_id,  -- Same employee as approver
    now()
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_lots_from_approved_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction_item record;
  v_lot_id uuid;
  v_lot_number text;
  v_supplier_id uuid;
  v_invoice_ref text;
BEGIN
  -- Only process IN transactions that just got approved
  IF NEW.transaction_type = 'in' 
     AND NEW.status = 'approved' 
     AND (OLD.status IS NULL OR OLD.status != 'approved')
     AND NEW.manager_approved = true
  THEN
    -- Get supplier and invoice reference from transaction
    v_supplier_id := NEW.supplier_id;
    v_invoice_ref := NEW.invoice_reference;

    -- Process each transaction item
    FOR v_transaction_item IN
      SELECT 
        ti.id,
        ti.item_id,
        ti.master_item_id,
        ti.quantity,
        ti.unit_cost,
        ti.purchase_unit_id,
        ti.purchase_quantity,
        ti.purchase_unit_multiplier,
        ti.notes,
        sis.store_id
      FROM public.inventory_transaction_items ti
      JOIN public.store_inventory_stock sis ON sis.id = ti.item_id
      WHERE ti.transaction_id = NEW.id
    LOOP
      -- Generate lot number
      v_lot_number := public.generate_lot_number(
        v_transaction_item.store_id,
        NULL  -- No supplier code for now
      );

      -- Create purchase lot
      INSERT INTO public.inventory_purchase_lots (
        lot_number,
        store_id,
        master_item_id,
        supplier_id,
        quantity_received,
        quantity_remaining,
        unit_cost,
        purchase_date,
        invoice_reference,
        notes,
        status,
        created_by_id,
        created_at,
        updated_at
      ) VALUES (
        v_lot_number,
        v_transaction_item.store_id,
        v_transaction_item.master_item_id,
        v_supplier_id,
        v_transaction_item.quantity,
        v_transaction_item.quantity,
        v_transaction_item.unit_cost,
        NEW.created_at,
        v_invoice_ref,
        CASE 
          WHEN v_transaction_item.purchase_quantity IS NOT NULL THEN
            'Purchased: ' || v_transaction_item.purchase_quantity || ' units at multiplier ' || v_transaction_item.purchase_unit_multiplier || '. ' || v_transaction_item.notes
          ELSE
            v_transaction_item.notes
        END,
        'active',
        NEW.requested_by_id,
        now(),
        now()
      )
      RETURNING id INTO v_lot_id;

      -- Update transaction item with lot_id
      UPDATE public.inventory_transaction_items
      SET lot_id = v_lot_id
      WHERE id = v_transaction_item.id;

      -- NOTE: We do NOT update store_inventory_stock here
      -- That's handled by trigger_update_inventory_on_approval to avoid duplication
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_queue_violation_report(p_reported_employee_id uuid, p_reporter_employee_id uuid, p_store_id uuid, p_violation_description text, p_queue_position_claimed integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_report_id uuid;
  v_violation_date date;
  v_responders uuid[];
  v_total_responders integer;
  v_expires_at timestamptz;
  v_min_votes_required integer;
  v_insufficient_responders boolean;
BEGIN
  -- Get current date in EST
  v_violation_date := CURRENT_DATE;

  -- Set expiration to 60 minutes from now
  v_expires_at := now() + interval '60 minutes';

  -- Validate: reporter and reported employee are different
  IF p_reporter_employee_id = p_reported_employee_id THEN
    RAISE EXCEPTION 'Cannot report yourself for a violation';
  END IF;

  -- Get minimum votes required from store settings
  SELECT violation_min_votes_required INTO v_min_votes_required
  FROM public.stores
  WHERE id = p_store_id;

  -- Default to 3 if not set
  v_min_votes_required := COALESCE(v_min_votes_required, 3);

  -- Get ALL employees who worked today (have attendance record), excluding reporter and reported employee
  -- REMOVED: check_out_time IS NULL condition to include all employees who worked that day
  SELECT array_agg(DISTINCT employee_id)
  INTO v_responders
  FROM public.attendance_records
  WHERE store_id = p_store_id
    AND check_in_time::date = v_violation_date
    AND employee_id NOT IN (p_reporter_employee_id, p_reported_employee_id);

  -- Count total responders
  v_total_responders := COALESCE(array_length(v_responders, 1), 0);

  -- Determine if there are insufficient responders
  v_insufficient_responders := v_total_responders < v_min_votes_required;

  -- Create the violation report with threshold information
  INSERT INTO public.queue_violation_reports (
    store_id,
    reported_employee_id,
    reporter_employee_id,
    violation_description,
    violation_date,
    queue_position_claimed,
    status,
    total_responses_required,
    total_responses_received,
    required_responder_ids,
    expires_at,
    min_votes_required_snapshot,
    insufficient_responders,
    votes_violation_confirmed,
    threshold_met
  ) VALUES (
    p_store_id,
    p_reported_employee_id,
    p_reporter_employee_id,
    p_violation_description,
    v_violation_date,
    p_queue_position_claimed,
    'collecting_responses',
    v_total_responders,
    0,
    COALESCE(v_responders, ARRAY[]::uuid[]),
    v_expires_at,
    v_min_votes_required,
    v_insufficient_responders,
    0,
    false
  )
  RETURNING id INTO v_report_id;

  -- Return success with report details
  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_report_id,
    'total_responders', v_total_responders,
    'required_responders', COALESCE(v_responders, ARRAY[]::uuid[]),
    'expires_at', v_expires_at,
    'min_votes_required', v_min_votes_required,
    'insufficient_responders', v_insufficient_responders
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.distribute_to_employee(p_store_id uuid, p_item_id uuid, p_to_employee_id uuid, p_quantity numeric, p_distributed_by_id uuid, p_notes text DEFAULT ''::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining_qty numeric;
  v_lot record;
  v_dist_qty numeric;
  v_distribution_number text;
  v_distribution_id uuid;
  v_distributions json[];
  v_result json;
BEGIN
  v_remaining_qty := p_quantity;
  v_distributions := ARRAY[]::json[];

  -- Validate sufficient stock exists
  IF (SELECT COALESCE(SUM(quantity_remaining), 0)
      FROM public.inventory_purchase_lots
      WHERE store_id = p_store_id
        AND item_id = p_item_id
        AND status = 'active'
        AND quantity_remaining > 0) < p_quantity THEN
    RAISE EXCEPTION 'Insufficient inventory available. Requested: %, Available: %',
      p_quantity,
      (SELECT COALESCE(SUM(quantity_remaining), 0)
       FROM public.inventory_purchase_lots
       WHERE store_id = p_store_id
         AND item_id = p_item_id
         AND status = 'active'
         AND quantity_remaining > 0);
  END IF;

  -- Process each lot in FIFO order
  FOR v_lot IN
    SELECT id, lot_number, quantity_remaining, unit_cost, purchase_date
    FROM public.inventory_purchase_lots
    WHERE store_id = p_store_id
      AND item_id = p_item_id
      AND status = 'active'
      AND quantity_remaining > 0
    ORDER BY purchase_date ASC, created_at ASC
  LOOP
    EXIT WHEN v_remaining_qty <= 0;

    -- Determine how much to take from this lot
    v_dist_qty := LEAST(v_remaining_qty, v_lot.quantity_remaining);

    -- Generate distribution number
    v_distribution_number := 'DIST-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                             LPAD(NEXTVAL('distribution_seq')::text, 4, '0');

    -- Create distribution record
    INSERT INTO public.inventory_distributions (
      distribution_number,
      store_id,
      item_id,
      lot_id,
      from_type,
      to_employee_id,
      quantity,
      unit_cost,
      distribution_date,
      distributed_by_id,
      condition_notes,
      status
    ) VALUES (
      v_distribution_number,
      p_store_id,
      p_item_id,
      v_lot.id,
      'store',
      p_to_employee_id,
      v_dist_qty,
      v_lot.unit_cost,
      NOW(),
      p_distributed_by_id,
      p_notes,
      'pending'
    )
    RETURNING id INTO v_distribution_id;

    -- Update lot quantity
    UPDATE public.inventory_purchase_lots
    SET quantity_remaining = quantity_remaining - v_dist_qty,
        status = CASE WHEN quantity_remaining - v_dist_qty <= 0 THEN 'depleted' ELSE 'active' END,
        updated_at = NOW()
    WHERE id = v_lot.id;

    -- Update or create employee inventory record
    INSERT INTO public.employee_inventory (
      employee_id,
      store_id,
      item_id,
      quantity_on_hand,
      total_value,
      updated_at
    ) VALUES (
      p_to_employee_id,
      p_store_id,
      p_item_id,
      v_dist_qty,
      v_dist_qty * v_lot.unit_cost,
      NOW()
    )
    ON CONFLICT (employee_id, item_id)
    DO UPDATE SET
      quantity_on_hand = employee_inventory.quantity_on_hand + v_dist_qty,
      total_value = employee_inventory.total_value + (v_dist_qty * v_lot.unit_cost),
      updated_at = NOW();

    -- Create employee_inventory_lots record
    INSERT INTO public.employee_inventory_lots (
      employee_id,
      store_id,
      item_id,
      lot_id,
      quantity,
      unit_cost,
      distributed_date
    ) VALUES (
      p_to_employee_id,
      p_store_id,
      p_item_id,
      v_lot.id,
      v_dist_qty,
      v_lot.unit_cost,
      NOW()
    );

    -- Add to results array
    v_distributions := array_append(v_distributions, json_build_object(
      'distribution_id', v_distribution_id,
      'distribution_number', v_distribution_number,
      'lot_number', v_lot.lot_number,
      'quantity', v_dist_qty,
      'unit_cost', v_lot.unit_cost
    ));

    v_remaining_qty := v_remaining_qty - v_dist_qty;
  END LOOP;

  -- Build result
  v_result := json_build_object(
    'success', true,
    'total_quantity', p_quantity,
    'distributions', array_to_json(v_distributions)
  );

  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.expire_violation_reports()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_expired_count integer;
  v_expired_reports jsonb;
BEGIN
  -- Find and expire reports that are past their expiration time
  WITH expired AS (
    UPDATE public.queue_violation_reports
    SET status = 'expired'
    WHERE status = 'collecting_responses'
      AND expires_at <= now()
    RETURNING 
      id,
      store_id,
      reported_employee_id,
      violation_description,
      votes_violation_confirmed,
      min_votes_required_snapshot,
      total_responses_received,
      total_responses_required,
      threshold_met,
      insufficient_responders
  )
  SELECT 
    COUNT(*)::integer,
    jsonb_agg(
      jsonb_build_object(
        'report_id', id,
        'store_id', store_id,
        'reported_employee_id', reported_employee_id,
        'votes_received', votes_violation_confirmed,
        'votes_required', min_votes_required_snapshot,
        'threshold_met', threshold_met,
        'insufficient_responders', insufficient_responders
      )
    )
  INTO v_expired_count, v_expired_reports
  FROM expired;

  -- Return summary of expired reports
  RETURN jsonb_build_object(
    'success', true,
    'expired_count', COALESCE(v_expired_count, 0),
    'expired_reports', COALESCE(v_expired_reports, '[]'::jsonb),
    'processed_at', now()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_all_roles_permissions(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  -- Build a JSONB object with all roles and their permissions
  SELECT jsonb_object_agg(
    role_name,
    permissions
  ) INTO v_result
  FROM (
    SELECT
      roles.role_name,
      jsonb_agg(
        jsonb_build_object(
          'permission_key', pd.permission_key,
          'module_name', pd.module_name,
          'action_name', pd.action_name,
          'display_name', pd.display_name,
          'description', pd.description,
          'is_critical', pd.is_critical,
          'is_enabled', COALESCE(rp.is_enabled, true),
          'updated_at', rp.updated_at
        )
        ORDER BY pd.module_name, pd.display_order, pd.display_name
      ) as permissions
    FROM (
      -- Generate all roles
      SELECT unnest(ARRAY['Admin', 'Owner', 'Manager', 'Supervisor', 'Receptionist', 'Technician', 'Spa Expert', 'Cashier']) as role_name
    ) roles
    CROSS JOIN public.permission_definitions pd
    LEFT JOIN public.role_permissions rp
      ON pd.permission_key = rp.permission_key
      AND rp.store_id = p_store_id
      AND rp.role_name = roles.role_name
    GROUP BY roles.role_name
  ) role_perms;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_employee_inventory(p_employee_id uuid)
 RETURNS TABLE(item_id uuid, item_code text, item_name text, category text, unit text, quantity_on_hand numeric, total_value numeric, average_cost numeric, lot_count bigint, last_audit_date timestamp with time zone, last_audit_variance numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ei.master_item_id as item_id,
    mi.code as item_code,
    mi.name as item_name,
    mi.category,
    mi.unit,
    ei.quantity_on_hand,
    ei.total_value,
    CASE
      WHEN ei.quantity_on_hand > 0 THEN ei.total_value / ei.quantity_on_hand
      ELSE 0
    END as average_cost,
    COUNT(eil.id) as lot_count,
    ei.last_audit_date,
    ei.last_audit_variance
  FROM public.employee_inventory ei
  JOIN public.master_inventory_items mi ON mi.id = ei.master_item_id
  LEFT JOIN public.employee_inventory_lots eil ON eil.employee_id = ei.employee_id
    AND eil.master_item_id = ei.master_item_id
  WHERE ei.employee_id = p_employee_id
  GROUP BY
    ei.master_item_id,
    mi.code,
    mi.name,
    mi.category,
    mi.unit,
    ei.quantity_on_hand,
    ei.total_value,
    ei.last_audit_date,
    ei.last_audit_variance
  ORDER BY mi.name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_employee_inventory_value(p_employee_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_value numeric;
BEGIN
  SELECT COALESCE(SUM(total_value), 0)
  INTO v_total_value
  FROM public.employee_inventory
  WHERE employee_id = p_employee_id;

  RETURN v_total_value;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_low_stock_items(p_store_id uuid)
 RETURNS TABLE(item_id uuid, item_code text, item_name text, category text, unit text, quantity_on_hand numeric, reorder_level numeric, quantity_needed numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.item_id,
    m.code,
    m.name,
    m.category,
    m.unit,
    s.quantity_on_hand,
    COALESCE(s.reorder_level_override, m.reorder_level) as reorder_level,
    COALESCE(s.reorder_level_override, m.reorder_level) - s.quantity_on_hand as quantity_needed
  FROM public.store_inventory_stock s
  JOIN public.master_inventory_items m ON m.id = s.item_id
  WHERE s.store_id = p_store_id
    AND s.quantity_on_hand <= COALESCE(s.reorder_level_override, m.reorder_level)
    AND m.is_active = true
  ORDER BY quantity_needed DESC, m.name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pending_approvals_for_management(p_store_id uuid)
 RETURNS TABLE(ticket_id uuid, ticket_no text, ticket_date date, closed_at timestamp with time zone, approval_deadline timestamp with time zone, customer_name text, customer_phone text, total numeric, closed_by_name text, closed_by_roles jsonb, hours_remaining numeric, service_name text, tip_customer numeric, tip_receptionist numeric, payment_method text, requires_higher_approval boolean, technician_names text, reason text, completed_by_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    st.id as ticket_id,
    st.ticket_no,
    st.ticket_date,
    st.closed_at,
    st.approval_deadline,
    st.customer_name,
    st.customer_phone,
    st.total,
    COALESCE(e.display_name, 'Unknown') as closed_by_name,
    st.closed_by_roles,
    EXTRACT(EPOCH FROM (st.approval_deadline - NOW())) / 3600 as hours_remaining,
    STRING_AGG(DISTINCT s.name, ', ') as service_name,
    SUM(ti.tip_customer_cash + ti.tip_customer_card) as tip_customer,
    SUM(ti.tip_receptionist) as tip_receptionist,
    st.payment_method,
    COALESCE(st.requires_higher_approval, false) as requires_higher_approval,
    STRING_AGG(DISTINCT emp.display_name, ', ') as technician_names,
    COALESCE(st.approval_reason, 'Requires management review') as reason,
    COALESCE(completed_emp.display_name, 'N/A') as completed_by_name
  FROM public.sale_tickets st
  LEFT JOIN public.employees e ON st.closed_by = e.id
  LEFT JOIN public.employees completed_emp ON st.completed_by = completed_emp.id
  LEFT JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
  LEFT JOIN public.store_services s ON ti.store_service_id = s.id
  LEFT JOIN public.employees emp ON ti.employee_id = emp.id
  WHERE st.store_id = p_store_id
    AND st.approval_status = 'pending_approval'
    AND st.closed_at IS NOT NULL
    AND st.approval_deadline > NOW()
    -- Include tickets requiring manager approval (conflict of interest OR high tips)
    AND st.approval_required_level = 'manager'
  GROUP BY st.id, e.display_name, completed_emp.display_name
  ORDER BY st.approval_deadline ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pending_cash_transaction_approvals(p_store_id uuid)
 RETURNS TABLE(transaction_id uuid, transaction_type text, amount numeric, description text, category text, date date, created_by_name text, created_by_id uuid, created_by_role text, created_at timestamp with time zone, requires_manager_approval boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ct.id as transaction_id,
    ct.transaction_type,
    ct.amount,
    ct.description,
    ct.category,
    ct.date,
    COALESCE(e.display_name, e.legal_name, 'Unknown') as created_by_name,
    ct.created_by_id,
    -- Compute role_permission from role array (same logic as frontend)
    CASE
      WHEN 'Admin' = ANY(e.role) OR 'Manager' = ANY(e.role) OR 'Owner' = ANY(e.role) THEN 'Admin'
      WHEN 'Supervisor' = ANY(e.role) THEN 'Supervisor'
      WHEN 'Receptionist' = ANY(e.role) THEN 'Receptionist'
      WHEN 'Cashier' = ANY(e.role) THEN 'Cashier'
      ELSE 'Technician'
    END as created_by_role,
    ct.created_at,
    ct.requires_manager_approval
  FROM public.cash_transactions ct
  LEFT JOIN public.employees e ON ct.created_by_id = e.id
  WHERE ct.store_id = p_store_id
    AND ct.status = 'pending_approval'
  ORDER BY ct.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pending_cash_transaction_change_proposals(p_store_id uuid)
 RETURNS TABLE(proposal_id uuid, cash_transaction_id uuid, transaction_type text, current_amount numeric, current_category text, current_description text, "current_date" date, proposed_amount numeric, proposed_category text, proposed_description text, proposed_date date, is_deletion_request boolean, reason_comment text, created_by_name text, created_by_id uuid, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS proposal_id,
    p.cash_transaction_id,
    ct.transaction_type::text,
    p.current_amount,
    p.current_category,
    p.current_description,
    p."current_date",
    p.proposed_amount,
    p.proposed_category,
    p.proposed_description,
    p.proposed_date,
    p.is_deletion_request,
    p.reason_comment,
    COALESCE(e.display_name, e.legal_name, 'Unknown') AS created_by_name,
    p.created_by_employee_id AS created_by_id,
    p.created_at
  FROM public.cash_transaction_change_proposals p
  INNER JOIN public.cash_transactions ct ON ct.id = p.cash_transaction_id
  INNER JOIN public.employees e ON e.id = p.created_by_employee_id
  WHERE p.store_id = p_store_id
    AND p.status = 'pending'
  ORDER BY p.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pending_cash_transaction_change_proposals_count(p_store_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)::integer
    FROM public.cash_transaction_change_proposals
    WHERE store_id = p_store_id
      AND status = 'pending'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_pending_inventory_approvals(p_employee_id uuid, p_store_id uuid)
 RETURNS TABLE(id uuid, transaction_number text, transaction_type text, requested_by_id uuid, requested_by_name text, recipient_id uuid, recipient_name text, notes text, status text, requires_recipient_approval boolean, requires_manager_approval boolean, recipient_approved boolean, manager_approved boolean, created_at timestamp with time zone, item_count bigint, total_value numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_roles text[];
  v_is_manager boolean;
BEGIN
  SELECT e.role INTO v_employee_roles
  FROM public.employees e
  WHERE e.id = p_employee_id;

  v_is_manager := 'Manager' = ANY(v_employee_roles) OR 'Owner' = ANY(v_employee_roles);

  RETURN QUERY
  SELECT
    it.id,
    it.transaction_number,
    it.transaction_type,
    it.requested_by_id,
    req.display_name as requested_by_name,
    it.recipient_id,
    COALESCE(rec.display_name, '') as recipient_name,
    it.notes,
    it.status,
    it.requires_recipient_approval,
    it.requires_manager_approval,
    it.recipient_approved,
    it.manager_approved,
    it.created_at,
    COUNT(iti.id) as item_count,
    SUM(iti.quantity * iti.unit_cost) as total_value
  FROM public.inventory_transactions it
  JOIN public.employees req ON req.id = it.requested_by_id
  LEFT JOIN public.employees rec ON rec.id = it.recipient_id
  LEFT JOIN public.inventory_transaction_items iti ON iti.transaction_id = it.id
  WHERE it.store_id = p_store_id
    AND it.status = 'pending'
    AND (
      (v_is_manager AND it.requires_manager_approval AND NOT it.manager_approved)
      OR
      (it.recipient_id = p_employee_id AND it.requires_recipient_approval AND NOT it.recipient_approved)
    )
  GROUP BY it.id, it.transaction_number, it.transaction_type, it.requested_by_id, req.display_name,
           it.recipient_id, rec.display_name, it.notes, it.status, it.requires_recipient_approval,
           it.requires_manager_approval, it.recipient_approved, it.manager_approved, it.created_at
  ORDER BY it.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_previous_safe_balance(p_store_id uuid, p_date date)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_previous_balance decimal(10, 2);
BEGIN
  SELECT closing_balance INTO v_previous_balance
  FROM public.safe_balance_history
  WHERE store_id = p_store_id
    AND date < p_date
  ORDER BY date DESC
  LIMIT 1;

  RETURN COALESCE(v_previous_balance, 0);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_role_permissions(p_store_id uuid, p_role_name text)
 RETURNS TABLE(permission_key text, module_name text, action_name text, display_name text, description text, is_critical boolean, is_enabled boolean, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    pd.permission_key,
    pd.module_name,
    pd.action_name,
    pd.display_name,
    pd.description,
    pd.is_critical,
    COALESCE(rp.is_enabled, true) as is_enabled,
    rp.updated_at
  FROM public.permission_definitions pd
  LEFT JOIN public.role_permissions rp
    ON pd.permission_key = rp.permission_key
    AND rp.store_id = p_store_id
    AND rp.role_name = p_role_name
  ORDER BY pd.module_name, pd.display_order, pd.display_name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_safe_balance_for_date(p_store_id uuid, p_date date)
 RETURNS TABLE(opening_balance numeric, total_deposits numeric, total_withdrawals numeric, closing_balance numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_opening_balance decimal(10, 2);
  v_total_deposits decimal(10, 2);
  v_total_withdrawals decimal(10, 2);
  v_closing_balance decimal(10, 2);
BEGIN
  -- Get opening balance from previous day's closing balance
  v_opening_balance := public.get_previous_safe_balance(p_store_id, p_date);

  -- Calculate total deposits for the day
  -- Deposits are:
  --   1. transaction_type = 'cash_out' AND category = 'Safe Deposit' (regular safe deposits)
  --   2. transaction_type = 'hq_deposit' (HQ deposits from branches - skips EOD)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_deposits
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND (
      (transaction_type = 'cash_out' AND category = 'Safe Deposit')
      OR transaction_type = 'hq_deposit'
    )
    AND status = 'approved';

  -- Calculate total withdrawals for the day
  -- Withdrawals are: transaction_type = 'cash_payout' AND category IN ('Payroll', 'Tip Payout', 'Headquarter Deposit', 'Other')
  SELECT COALESCE(SUM(amount), 0) INTO v_total_withdrawals
  FROM public.cash_transactions
  WHERE store_id = p_store_id
    AND date = p_date
    AND transaction_type = 'cash_payout'
    AND category IN ('Payroll', 'Tip Payout', 'Headquarter Deposit', 'Other')
    AND status = 'approved';

  -- Calculate closing balance: opening + deposits - withdrawals
  v_closing_balance := v_opening_balance + v_total_deposits - v_total_withdrawals;

  RETURN QUERY SELECT v_opening_balance, v_total_deposits, v_total_withdrawals, v_closing_balance;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_safe_balance_history(p_store_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 30)
 RETURNS TABLE(id uuid, date date, opening_balance numeric, closing_balance numeric, total_deposits numeric, total_withdrawals numeric, balance_change numeric, created_by_name text, updated_by_name text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    sbh.id,
    sbh.date,
    sbh.opening_balance,
    sbh.closing_balance,
    sbh.total_deposits,
    sbh.total_withdrawals,
    (sbh.closing_balance - sbh.opening_balance) as balance_change,
    creator.name as created_by_name,
    updater.name as updated_by_name,
    sbh.created_at,
    sbh.updated_at
  FROM public.safe_balance_history sbh
  LEFT JOIN public.employees creator ON sbh.created_by_id = creator.id
  LEFT JOIN public.employees updater ON sbh.updated_by_id = updater.id
  WHERE sbh.store_id = p_store_id
    AND (p_start_date IS NULL OR sbh.date >= p_start_date)
    AND (p_end_date IS NULL OR sbh.date <= p_end_date)
  ORDER BY sbh.date DESC
  LIMIT p_limit;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_small_service_threshold(p_store_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_threshold numeric;
BEGIN
  SELECT (setting_value)::numeric INTO v_threshold
  FROM public.app_settings
  WHERE store_id = p_store_id AND setting_key = 'small_service_threshold';

  RETURN COALESCE(v_threshold, 30);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_sorted_technicians_for_store(p_store_id uuid, p_date text)
 RETURNS TABLE(employee_id uuid, display_name text, role text[], queue_status text, queue_position integer, current_ticket_id uuid, ticket_customer_name text, ticket_start_time timestamp with time zone, estimated_duration_min integer, time_elapsed_min integer, time_remaining_min integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_day_name text;
BEGIN
  v_day_name := CASE EXTRACT(DOW FROM p_date::date)::integer
    WHEN 0 THEN 'sunday'
    WHEN 1 THEN 'monday'
    WHEN 2 THEN 'tuesday'
    WHEN 3 THEN 'wednesday'
    WHEN 4 THEN 'thursday'
    WHEN 5 THEN 'friday'
    WHEN 6 THEN 'saturday'
  END;

  RETURN QUERY
  WITH
  -- Get employees with open tickets (for status determination)
  employees_with_open_tickets AS (
    SELECT DISTINCT ti.employee_id
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
  ),
  -- Get ticket details for display
  current_tickets AS (
    SELECT DISTINCT ON (ti.employee_id)
      ti.employee_id,
      st.id as ticket_id,
      st.customer_name,
      st.opened_at as start_time,
      EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - st.opened_at))/60 as elapsed_min
    FROM public.sale_tickets st
    JOIN public.ticket_items ti ON ti.sale_ticket_id = st.id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
    ORDER BY ti.employee_id, st.opened_at ASC
  ),
  -- Get estimated durations
  estimated_durations AS (
    SELECT
      ti.employee_id,
      SUM(COALESCE(ss.duration_min, 0)) as total_estimated_min
    FROM public.ticket_items ti
    LEFT JOIN public.store_services ss ON ss.id = ti.store_service_id
    JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE st.store_id = p_store_id
      AND st.ticket_date = p_date::date
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
    GROUP BY ti.employee_id
  ),
  -- Get queue status for all technicians
  all_queue_status AS (
    SELECT
      trq.employee_id,
      trq.status as queue_status_raw,
      trq.ready_at,
      trq.current_open_ticket_id
    FROM public.technician_ready_queue trq
    WHERE trq.store_id = p_store_id
  ),
  -- First, get all FILTERED technicians with their calculated queue_status
  filtered_technicians AS (
    SELECT
      e.id as employee_id,
      e.display_name,
      e.role,
      -- Calculate display status
      CASE
        WHEN qs.queue_status_raw = 'small_service' THEN 'small_service'::text
        WHEN qs.queue_status_raw = 'busy' THEN 'busy'::text
        WHEN ct.employee_id IS NOT NULL THEN 'busy'::text
        WHEN qs.queue_status_raw = 'ready' THEN 'ready'::text
        ELSE 'neutral'::text
      END as queue_status,
      qs.ready_at,
      COALESCE(qs.current_open_ticket_id, ct.ticket_id) as current_ticket_id,
      ct.customer_name as ticket_customer_name,
      ct.start_time as ticket_start_time,
      ed.total_estimated_min::integer as estimated_duration_min,
      ct.elapsed_min::integer as time_elapsed_min,
      GREATEST(0, COALESCE(ed.total_estimated_min, 0) - COALESCE(ct.elapsed_min, 0))::integer as time_remaining_min
    FROM public.employees e
    LEFT JOIN all_queue_status qs ON qs.employee_id = e.id
    LEFT JOIN current_tickets ct ON ct.employee_id = e.id
    LEFT JOIN estimated_durations ed ON ed.employee_id = e.id
    WHERE
      -- Apply ALL filters here
      LOWER(e.status) = 'active'
      -- FIX: Use correct roles (Technician, Supervisor, Manager, Owner)
      AND (
        e.role @> ARRAY['Technician']::text[]
        OR e.role @> ARRAY['Supervisor']::text[]
        OR e.role @> ARRAY['Manager']::text[]
        OR e.role @> ARRAY['Owner']::text[]
      )
      AND NOT e.role @> ARRAY['Cashier']::text[]
      AND EXISTS (
        SELECT 1 FROM public.employee_stores es
        WHERE es.employee_id = e.id AND es.store_id = p_store_id
      )
      AND (
        COALESCE((e.weekly_schedule->v_day_name->>'is_working')::boolean, false) = true
        OR EXISTS (
          SELECT 1 FROM public.attendance_records ar
          WHERE ar.employee_id = e.id
          AND ar.store_id = p_store_id
          AND ar.work_date = p_date::date
          AND ar.status = 'checked_in'
        )
      )
  )
  -- Now calculate positions ONLY for visible ready/small_service technicians
  SELECT
    ft.employee_id,
    ft.display_name,
    ft.role,
    ft.queue_status,
    -- Calculate position only for ready/small_service, NULL for others
    CASE
      WHEN ft.queue_status IN ('ready', 'small_service') THEN
        ROW_NUMBER() OVER (
          PARTITION BY (ft.queue_status IN ('ready', 'small_service'))
          ORDER BY ft.ready_at ASC NULLS LAST
        )::integer
      ELSE NULL
    END as queue_position,
    ft.current_ticket_id,
    ft.ticket_customer_name,
    ft.ticket_start_time,
    ft.estimated_duration_min,
    ft.time_elapsed_min,
    ft.time_remaining_min
  FROM filtered_technicians ft
  ORDER BY
    -- Ready/small_service first, then neutral, then busy
    CASE
      WHEN ft.queue_status IN ('ready', 'small_service') THEN 1
      WHEN ft.queue_status = 'neutral' THEN 2
      ELSE 3
    END,
    -- Within ready/small_service, order by ready_at
    ft.ready_at ASC NULLS LAST,
    ft.display_name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_store_attendance(p_store_id uuid, p_start_date date, p_end_date date, p_employee_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(attendance_record_id uuid, employee_id uuid, employee_name text, work_date date, check_in_time timestamp with time zone, check_out_time timestamp with time zone, total_hours numeric, status text, pay_type text, store_code text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ar.id as attendance_record_id,
    ar.employee_id,
    e.display_name as employee_name,
    ar.work_date,
    ar.check_in_time,
    ar.check_out_time,
    ar.total_hours,
    ar.status,
    e.pay_type,  -- Use current pay_type from employees table, not historical from attendance_records
    s.code as store_code
  FROM public.attendance_records ar
  JOIN public.employees e ON ar.employee_id = e.id
  JOIN public.stores s ON ar.store_id = s.id
  WHERE
    -- Show attendance from ALL stores for employees assigned to the selected store
    ar.employee_id IN (
      SELECT es.employee_id
      FROM public.employee_stores es
      WHERE es.store_id = p_store_id
    )
    AND ar.work_date BETWEEN p_start_date AND p_end_date
    AND (p_employee_id IS NULL OR ar.employee_id = p_employee_id)
    AND (e.attendance_display IS NULL OR e.attendance_display = true)
  ORDER BY ar.work_date DESC, ar.check_in_time ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_store_inventory_with_details(p_store_id uuid)
 RETURNS TABLE(stock_id uuid, item_id uuid, code text, name text, description text, category text, unit text, quantity_on_hand numeric, unit_cost numeric, reorder_level numeric, is_low_stock boolean, is_active boolean, last_counted_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as stock_id,
    m.id as item_id,
    m.code,
    m.name,
    m.description,
    m.category,
    m.unit,
    s.quantity_on_hand,
    COALESCE(s.unit_cost_override, m.unit_cost) as unit_cost,
    COALESCE(s.reorder_level_override, m.reorder_level) as reorder_level,
    (s.quantity_on_hand <= COALESCE(s.reorder_level_override, m.reorder_level)) as is_low_stock,
    m.is_active,
    s.last_counted_at,
    s.created_at,
    s.updated_at
  FROM public.store_inventory_stock s
  JOIN public.master_inventory_items m ON m.id = s.item_id
  WHERE s.store_id = p_store_id
    AND m.is_active = true
  ORDER BY m.name;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_store_timezone(p_store_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Return default timezone (stores table doesn't have timezone column)
  -- All stores operate in Eastern timezone
  RETURN 'America/New_York';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_ticket_close_smart(p_ticket_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- For small_service: return to ready status (keep position via ready_at)
  UPDATE public.technician_ready_queue
  SET
    status = 'ready',
    current_open_ticket_id = NULL,
    updated_at = now()
  WHERE current_open_ticket_id = p_ticket_id AND status = 'small_service';

  -- For regular busy: remove from queue entirely
  DELETE FROM public.technician_ready_queue
  WHERE current_open_ticket_id = p_ticket_id AND status = 'busy';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_pending_cash_transaction_change_proposal(p_cash_transaction_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.cash_transaction_change_proposals
    WHERE cash_transaction_id = p_cash_transaction_id
      AND status = 'pending'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.insert_transaction_items_batch(p_transaction_id uuid, p_items jsonb)
 RETURNS TABLE(success boolean, items_inserted integer, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item jsonb;
  v_count integer := 0;
BEGIN
  -- Validate transaction exists
  IF NOT EXISTS (SELECT 1 FROM public.inventory_transactions WHERE id = p_transaction_id) THEN
    RETURN QUERY SELECT false, 0, 'Transaction not found'::text;
    RETURN;
  END IF;

  -- Validate items array
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN QUERY SELECT false, 0, 'No items provided'::text;
    RETURN;
  END IF;

  -- Insert each item from the JSON array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.inventory_transaction_items (
      transaction_id,
      item_id,
      quantity,
      unit_cost,
      purchase_unit_id,
      purchase_quantity,
      purchase_unit_price,
      purchase_unit_multiplier,
      notes,
      created_at
    ) VALUES (
      p_transaction_id,
      (v_item->>'item_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_cost')::numeric,
      CASE WHEN v_item->>'purchase_unit_id' IS NOT NULL
        THEN (v_item->>'purchase_unit_id')::uuid
        ELSE NULL
      END,
      CASE WHEN v_item->>'purchase_quantity' IS NOT NULL
        THEN (v_item->>'purchase_quantity')::numeric
        ELSE NULL
      END,
      CASE WHEN v_item->>'purchase_unit_price' IS NOT NULL
        THEN (v_item->>'purchase_unit_price')::numeric
        ELSE NULL
      END,
      CASE WHEN v_item->>'purchase_unit_multiplier' IS NOT NULL
        THEN (v_item->>'purchase_unit_multiplier')::numeric
        ELSE NULL
      END,
      COALESCE(v_item->>'notes', ''),
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT true, v_count, 'Items inserted successfully'::text;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_last_in_ready_queue(p_employee_id uuid, p_store_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_max_position integer;
  v_tech_position integer;
BEGIN
  -- Get the maximum position (last person) among READY technicians only
  SELECT COUNT(*) INTO v_max_position
  FROM public.technician_ready_queue
  WHERE store_id = p_store_id AND status = 'ready';

  -- Get this technician's position (if they are ready)
  SELECT pos INTO v_tech_position
  FROM (
    SELECT employee_id, ROW_NUMBER() OVER (ORDER BY ready_at ASC) as pos
    FROM public.technician_ready_queue
    WHERE store_id = p_store_id AND status = 'ready'
  ) q
  WHERE q.employee_id = p_employee_id;

  -- Technician is last if their position equals the max position
  RETURN v_tech_position = v_max_position AND v_max_position IS NOT NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_pin_in_use(pin_input text, exclude_employee_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  emp_record RECORD;
BEGIN
  -- Validate PIN format
  IF pin_input !~ '^\d{4}$' THEN
    RETURN false;
  END IF;

  -- Check if PIN matches any existing employee's hash
  FOR emp_record IN
    SELECT id, pin_code_hash
    FROM public.employees
    WHERE status = 'Active'
      AND pin_code_hash IS NOT NULL
      AND (exclude_employee_id IS NULL OR id != exclude_employee_id)
  LOOP
    -- Check if the PIN matches this employee's hash (FIXED: added extensions. prefix)
    IF emp_record.pin_code_hash = extensions.crypt(pin_input, emp_record.pin_code_hash) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.join_ready_queue_with_checkin(p_employee_id uuid, p_store_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_attendance record;
  v_today date;
  v_store_timezone text;
  v_all_completed boolean;
  v_ticket_id uuid;
  v_position integer;
  v_total integer;
  v_ready_at timestamptz;
  v_cooldown_record record;
  v_minutes_remaining integer;
  v_removed_by_name text;
BEGIN
  -- Get store timezone and calculate today's date in that timezone
  -- This ensures consistency with check_in_employee which uses the same method
  v_store_timezone := public.get_store_timezone(p_store_id);
  v_today := (CURRENT_TIMESTAMP AT TIME ZONE v_store_timezone)::date;

  -- Check for active cooldown
  SELECT
    qrl.cooldown_expires_at,
    qrl.reason,
    qrl.notes,
    e.display_name as removed_by_name,  -- Fixed: was e.name
    EXTRACT(EPOCH FROM (qrl.cooldown_expires_at - now())) / 60 as minutes_remaining
  INTO v_cooldown_record
  FROM public.queue_removals_log qrl
  JOIN public.employees e ON e.id = qrl.removed_by_employee_id
  WHERE qrl.employee_id = p_employee_id
    AND qrl.store_id = p_store_id
    AND qrl.cooldown_expires_at > now()
  ORDER BY qrl.removed_at DESC
  LIMIT 1;

  IF v_cooldown_record IS NOT NULL THEN
    v_minutes_remaining := CEIL(v_cooldown_record.minutes_remaining);

    RETURN json_build_object(
      'success', false,
      'error', 'COOLDOWN_ACTIVE',
      'message', format(
        'You cannot join the queue for %s more minutes. You were removed for: %s',
        v_minutes_remaining,
        v_cooldown_record.reason
      ),
      'cooldown_expires_at', v_cooldown_record.cooldown_expires_at,
      'minutes_remaining', v_minutes_remaining,
      'reason', v_cooldown_record.reason,
      'notes', v_cooldown_record.notes,
      'removed_by_name', v_cooldown_record.removed_by_name,
      'position', 0,
      'total', 0
    );
  END IF;

  -- Check if employee is checked in
  SELECT *
  INTO v_attendance
  FROM public.attendance_records
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id
    AND work_date = v_today
    AND status = 'checked_in'
  ORDER BY check_in_time DESC
  LIMIT 1;

  IF v_attendance IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'CHECK_IN_REQUIRED',
      'message', 'You must check in before joining the ready queue',
      'position', 0,
      'total', 0
    );
  END IF;

  -- Mark individual services (ticket_items) assigned to this technician as completed
  UPDATE public.ticket_items ti
  SET
    completed_at = NOW(),
    completed_by = p_employee_id,
    updated_at = NOW()
  WHERE ti.employee_id = p_employee_id
    AND ti.completed_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.sale_tickets st
      WHERE st.id = ti.sale_ticket_id
        AND st.store_id = p_store_id
        AND st.closed_at IS NULL
    );

  -- For each affected ticket, check if ALL services are now completed
  FOR v_ticket_id IN (
    SELECT DISTINCT ti.sale_ticket_id
    FROM public.ticket_items ti
    INNER JOIN public.sale_tickets st ON st.id = ti.sale_ticket_id
    WHERE ti.employee_id = p_employee_id
      AND st.store_id = p_store_id
      AND st.closed_at IS NULL
      AND st.completed_at IS NULL
  )
  LOOP
    v_all_completed := public.check_ticket_all_services_completed(v_ticket_id);

    IF v_all_completed THEN
      -- Mark ticket as completed but keep it open
      UPDATE public.sale_tickets
      SET
        completed_at = NOW(),
        completed_by = p_employee_id,
        updated_at = NOW()
      WHERE id = v_ticket_id
        AND completed_at IS NULL;
    END IF;
  END LOOP;

  -- Remove any existing entry for this technician in this store
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id;

  -- Add technician to ready queue
  INSERT INTO public.technician_ready_queue (
    employee_id,
    store_id,
    status,
    ready_at
  ) VALUES (
    p_employee_id,
    p_store_id,
    'ready',
    NOW()
  )
  RETURNING ready_at INTO v_ready_at;

  -- Calculate position (count how many people joined before this employee)
  SELECT COUNT(*) + 1
  INTO v_position
  FROM public.technician_ready_queue
  WHERE store_id = p_store_id
    AND status = 'ready'
    AND ready_at < v_ready_at;

  -- Get total count of ready employees in this store
  SELECT COUNT(*)
  INTO v_total
  FROM public.technician_ready_queue
  WHERE store_id = p_store_id
    AND status = 'ready';

  RETURN json_build_object(
    'success', true,
    'position', v_position,
    'total', v_total
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.leave_ready_queue(p_employee_id uuid, p_store_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Remove employee from ready queue
  DELETE FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id
    AND store_id = p_store_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_cash_transaction_edit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Only log if this is an actual update (not insert)
  IF TG_OP = 'UPDATE' THEN
    -- Check if any tracked fields changed
    IF OLD.amount IS DISTINCT FROM NEW.amount
       OR OLD.description IS DISTINCT FROM NEW.description
       OR OLD.category IS DISTINCT FROM NEW.category THEN
      
      INSERT INTO public.cash_transaction_edit_history (
        transaction_id,
        edited_by_id,
        edited_at,
        old_amount,
        new_amount,
        old_description,
        new_description,
        old_category,
        new_category
      ) VALUES (
        NEW.id,
        NEW.last_edited_by_id,
        NEW.last_edited_at,
        OLD.amount,
        NEW.amount,
        OLD.description,
        NEW.description,
        OLD.category,
        NEW.category
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_permission_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.is_enabled != NEW.is_enabled THEN
    INSERT INTO public.role_permissions_audit (store_id, role_name, permission_key, old_value, new_value, changed_by)
    VALUES (NEW.store_id, NEW.role_name, NEW.permission_key, OLD.is_enabled, NEW.is_enabled, NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_technician_busy_smart(p_employee_id uuid, p_ticket_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_store_id uuid;
  v_threshold numeric;
  v_ticket_total numeric;
  v_is_last boolean;
  v_current_status text;
  v_new_status text;
BEGIN
  -- Get store_id from ticket
  SELECT store_id INTO v_store_id
  FROM public.sale_tickets
  WHERE id = p_ticket_id;

  IF v_store_id IS NULL THEN
    RETURN; -- Ticket not found
  END IF;

  -- Get current queue status
  SELECT status INTO v_current_status
  FROM public.technician_ready_queue
  WHERE employee_id = p_employee_id AND store_id = v_store_id;

  -- If not in queue, nothing to do
  IF v_current_status IS NULL THEN
    RETURN;
  END IF;

  -- If already busy (not small_service), stay busy
  IF v_current_status = 'busy' THEN
    -- Just update the ticket reference if needed
    UPDATE public.technician_ready_queue
    SET current_open_ticket_id = p_ticket_id, updated_at = now()
    WHERE employee_id = p_employee_id AND store_id = v_store_id;
    RETURN;
  END IF;

  -- Calculate current ticket total (all items)
  v_ticket_total := public.calculate_ticket_total(p_ticket_id);

  -- Get threshold
  v_threshold := public.get_small_service_threshold(v_store_id);

  -- Check if technician is last in queue (only if currently ready)
  IF v_current_status = 'ready' THEN
    v_is_last := public.is_last_in_ready_queue(p_employee_id, v_store_id);
  ELSE
    v_is_last := false;
  END IF;

  -- Determine new status
  IF v_ticket_total < v_threshold AND v_is_last THEN
    v_new_status := 'small_service';
  ELSE
    v_new_status := 'busy';
  END IF;

  -- If currently small_service and total now >= threshold, upgrade to busy
  IF v_current_status = 'small_service' AND v_ticket_total >= v_threshold THEN
    v_new_status := 'busy';
  END IF;

  -- Update queue status
  UPDATE public.technician_ready_queue
  SET
    status = v_new_status,
    current_open_ticket_id = p_ticket_id,
    updated_at = now()
  WHERE employee_id = p_employee_id AND store_id = v_store_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_cash_transaction_change_proposal(p_proposal_id uuid, p_reviewer_employee_id uuid, p_review_comment text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposal RECORD;
  v_reviewer RECORD;
BEGIN
  -- Validate review comment is provided
  IF p_review_comment IS NULL OR trim(p_review_comment) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rejection reason is required');
  END IF;

  -- Validate reviewer exists and is Owner, Admin, or Manager
  SELECT * INTO v_reviewer
  FROM public.employees
  WHERE id = p_reviewer_employee_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reviewer not found');
  END IF;

  -- Check role array instead of removed role_permission column
  IF NOT ('Owner' = ANY(v_reviewer.role) OR 'Admin' = ANY(v_reviewer.role) OR 'Manager' = ANY(v_reviewer.role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only Owners or Admins can reject change proposals');
  END IF;

  -- Get the proposal
  SELECT * INTO v_proposal
  FROM public.cash_transaction_change_proposals
  WHERE id = p_proposal_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal not found');
  END IF;

  IF v_proposal.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposal has already been reviewed');
  END IF;

  -- Update the proposal status
  UPDATE public.cash_transaction_change_proposals
  SET
    status = 'rejected',
    reviewed_by_employee_id = p_reviewer_employee_id,
    reviewed_at = now(),
    review_comment = trim(p_review_comment)
  WHERE id = p_proposal_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Change request rejected'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_ticket(p_ticket_id uuid, p_employee_id uuid, p_rejection_reason text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ticket public.sale_tickets%ROWTYPE;
BEGIN
  -- Get the ticket
  SELECT * INTO v_ticket FROM public.sale_tickets WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Ticket not found');
  END IF;

  -- Check if ticket is in pending_approval status
  IF v_ticket.approval_status != 'pending_approval' THEN
    RETURN json_build_object('success', false, 'message', 'Ticket is not pending approval');
  END IF;

  -- Check if employee is assigned to this ticket
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_items WHERE sale_ticket_id = p_ticket_id AND employee_id = p_employee_id
  ) THEN
    RETURN json_build_object('success', false, 'message', 'You are not assigned to this ticket');
  END IF;

  -- Reject the ticket
  UPDATE public.sale_tickets
  SET
    approval_status = 'rejected',
    rejection_reason = p_rejection_reason,
    requires_admin_review = true,
    updated_at = now()
  WHERE id = p_ticket_id;

  RETURN json_build_object('success', true, 'message', 'Ticket rejected and sent for admin review');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reset_employee_pin(emp_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  temp_pin text;
  max_attempts int := 50;
  attempt_count int := 0;
BEGIN
  -- Generate random 4-digit PIN until we find a unique one
  LOOP
    temp_pin := lpad(floor(random() * 10000)::text, 4, '0');

    -- Check if this PIN is already in use by another employee
    IF NOT public.is_pin_in_use(temp_pin, emp_id) THEN
      EXIT; -- Found a unique PIN, exit the loop
    END IF;

    attempt_count := attempt_count + 1;

    -- Safety check to avoid infinite loop
    IF attempt_count >= max_attempts THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unable to generate unique PIN. Please try again.');
    END IF;
  END LOOP;

  -- Update employee with temporary PIN (FIXED: added extensions. prefix to both crypt and gen_salt)
  UPDATE public.employees
  SET
    pin_code_hash = extensions.crypt(temp_pin, extensions.gen_salt('bf')),
    pin_temp = temp_pin,
    last_pin_change = now(),
    updated_at = now()
  WHERE id = emp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'temp_pin', temp_pin);
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

CREATE OR REPLACE FUNCTION public.set_approval_deadline()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_closer_roles text[];
  v_performers uuid[];
  v_performer_count int;
  v_closer_is_performer boolean;
  v_closer_is_receptionist boolean;
  v_closer_is_supervisor boolean;
  v_closer_is_technician boolean;
  v_closer_is_spa_expert boolean;
  v_required_level text;
  v_reason text;
  v_performed_and_closed boolean;
  v_total_tips numeric;
BEGIN
  IF NEW.closed_at IS NOT NULL AND (OLD.closed_at IS NULL OR OLD.closed_at IS DISTINCT FROM NEW.closed_at) THEN

    NEW.approval_status := 'pending_approval';
    NEW.approval_deadline := NEW.closed_at + INTERVAL '48 hours';

    -- Calculate total tips for this ticket
    SELECT COALESCE(SUM(
      COALESCE(tip_customer_cash, 0) +
      COALESCE(tip_customer_card, 0) +
      COALESCE(tip_receptionist, 0)
    ), 0)
    INTO v_total_tips
    FROM ticket_items
    WHERE sale_ticket_id = NEW.id;

    -- Get closer's roles
    v_closer_roles := COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.closed_by_roles)),
      ARRAY[]::text[]
    );

    v_closer_is_receptionist := 'Receptionist' = ANY(v_closer_roles);
    v_closer_is_supervisor := 'Supervisor' = ANY(v_closer_roles);
    v_closer_is_technician := 'Technician' = ANY(v_closer_roles);
    v_closer_is_spa_expert := 'Spa Expert' = ANY(v_closer_roles);

    -- Get performers
    SELECT
      ARRAY_AGG(DISTINCT employee_id),
      COUNT(DISTINCT employee_id)
    INTO v_performers, v_performer_count
    FROM ticket_items
    WHERE sale_ticket_id = NEW.id;

    v_closer_is_performer := NEW.closed_by = ANY(v_performers);
    v_performed_and_closed := (v_performer_count = 1 AND v_closer_is_performer);

    -- HIGH TIP CHECK: If tips exceed $20, require management approval
    IF v_total_tips > 20.00 THEN
      v_required_level := 'manager';
      v_reason := format('Ticket has tips totaling $%s (exceeds $20 limit) - requires Manager/Admin approval',
                        ROUND(v_total_tips, 2)::text);
      NEW.requires_higher_approval := true;

    -- Conflict of interest checks (existing logic)
    ELSIF v_closer_is_supervisor AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Supervisor performed service and closed ticket themselves - requires Manager/Admin approval';
      NEW.requires_higher_approval := true;

    ELSIF v_closer_is_receptionist AND v_performed_and_closed AND
          (v_closer_is_technician OR v_closer_is_spa_expert) THEN
      v_required_level := 'supervisor';
      v_reason := 'Receptionist performed service and closed ticket themselves - requires Supervisor approval';
      NEW.requires_higher_approval := true;

    ELSIF v_closer_is_technician AND v_closer_is_receptionist AND v_performed_and_closed THEN
      v_required_level := 'manager';
      v_reason := 'Employee with both Technician and Receptionist roles performed and closed ticket - requires Manager/Admin approval';
      NEW.requires_higher_approval := true;

    ELSE
      v_required_level := 'technician';
      v_reason := 'Standard technician peer approval';
      NEW.requires_higher_approval := false;
    END IF;

    NEW.approval_required_level := v_required_level;
    NEW.approval_reason := v_reason;
    NEW.performed_and_closed_by_same_person := v_performed_and_closed;

  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_employee_pin(emp_id uuid, new_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  -- Validate PIN is exactly 4 digits
  IF new_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  -- Update employee with new PIN
  UPDATE employees
  SET 
    pin_code_hash = extensions.crypt(new_pin, extensions.gen_salt('bf')),
    pin_temp = NULL,
    last_pin_change = now(),
    updated_at = now()
  WHERE id = emp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Employee not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_violation_response(p_violation_report_id uuid, p_employee_id uuid, p_response boolean, p_response_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_report record;
  v_new_total integer;
  v_new_yes_votes integer;
  v_threshold_met boolean;
BEGIN
  -- Get current report status
  SELECT * INTO v_report
  FROM public.queue_violation_reports
  WHERE id = p_violation_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Violation report not found';
  END IF;

  -- Check if report is still collecting responses
  IF v_report.status != 'collecting_responses' THEN
    RAISE EXCEPTION 'This report is no longer accepting responses';
  END IF;

  -- Check if already responded
  IF EXISTS (
    SELECT 1 FROM public.queue_violation_responses
    WHERE violation_report_id = p_violation_report_id
      AND employee_id = p_employee_id
  ) THEN
    RAISE EXCEPTION 'You have already responded to this report';
  END IF;

  -- Insert the response
  INSERT INTO public.queue_violation_responses (
    violation_report_id,
    employee_id,
    response,
    response_notes
  ) VALUES (
    p_violation_report_id,
    p_employee_id,
    p_response,
    p_response_notes
  );

  -- Update response count and YES votes count
  UPDATE public.queue_violation_reports
  SET 
    total_responses_received = total_responses_received + 1,
    votes_violation_confirmed = votes_violation_confirmed + CASE WHEN p_response THEN 1 ELSE 0 END
  WHERE id = p_violation_report_id
  RETURNING 
    total_responses_received,
    votes_violation_confirmed
  INTO v_new_total, v_new_yes_votes;

  -- Check if threshold is met
  v_threshold_met := v_new_yes_votes >= v_report.min_votes_required_snapshot;

  -- Update threshold_met flag
  UPDATE public.queue_violation_reports
  SET threshold_met = v_threshold_met
  WHERE id = p_violation_report_id;

  -- If all responses collected, move to pending approval
  IF v_new_total >= v_report.total_responses_required THEN
    UPDATE public.queue_violation_reports
    SET status = 'pending_approval'
    WHERE id = p_violation_report_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'responses_received', v_new_total,
    'responses_required', v_report.total_responses_required,
    'votes_violation_confirmed', v_new_yes_votes,
    'min_votes_required', v_report.min_votes_required_snapshot,
    'threshold_met', v_threshold_met,
    'status', CASE 
      WHEN v_new_total >= v_report.total_responses_required THEN 'pending_approval' 
      ELSE 'collecting_responses' 
    END
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_mark_technician_busy()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_ticket_closed_at timestamptz;
BEGIN
  -- Check if the ticket is still open
  SELECT closed_at INTO v_ticket_closed_at
  FROM public.sale_tickets
  WHERE id = NEW.sale_ticket_id;

  -- Only mark as busy if ticket is still open
  IF v_ticket_closed_at IS NULL THEN
    PERFORM public.mark_technician_busy_smart(NEW.employee_id, NEW.sale_ticket_id);
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_mark_technicians_available()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Check completed_at (not closed_at) since trigger fires on completed_at
  -- completed_at is set when technician finishes service and clicks "Ready"
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    PERFORM public.handle_ticket_close_smart(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_inventory_on_transaction_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item record;
  v_quantity_change numeric;
BEGIN
  -- Only process when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    -- Loop through all items in the transaction
    FOR v_item IN 
      SELECT master_item_id as item_id, quantity, unit_cost
      FROM public.inventory_transaction_items
      WHERE transaction_id = NEW.id
    LOOP
      -- Calculate quantity change based on transaction type
      IF NEW.transaction_type = 'in' THEN
        v_quantity_change := v_item.quantity;  -- Add to stock
      ELSE
        v_quantity_change := -v_item.quantity; -- Subtract from stock
      END IF;
      
      -- Adjust stock using helper function
      PERFORM public.adjust_store_stock(
        NEW.store_id,
        v_item.item_id,
        v_quantity_change,
        false  -- Don't allow negative stock
      );
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_lot_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Mark as depleted if quantity remaining is 0
  IF NEW.quantity_remaining <= 0 AND NEW.status = 'active' THEN
    NEW.status := 'depleted';
  END IF;

  -- Mark as expired if past expiration date
  IF NEW.expiration_date IS NOT NULL
     AND NEW.expiration_date < now()
     AND NEW.status = 'active' THEN
    NEW.status := 'expired';
  END IF;

  NEW.updated_at := now();

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_product_preference(p_store_id uuid, p_item_id uuid, p_purchase_unit_id uuid, p_purchase_cost numeric, p_updated_by_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.store_product_preferences (
    store_id,
    item_id,
    last_used_purchase_unit_id,
    last_purchase_cost,
    last_used_at,
    updated_by_id,
    created_at,
    updated_at
  ) VALUES (
    p_store_id,
    p_item_id,
    p_purchase_unit_id,
    p_purchase_cost,
    NOW(),
    p_updated_by_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (store_id, item_id)
  DO UPDATE SET
    last_used_purchase_unit_id = p_purchase_unit_id,
    last_purchase_cost = p_purchase_cost,
    last_used_at = NOW(),
    updated_by_id = p_updated_by_id,
    updated_at = NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_role_permission(p_store_id uuid, p_role_name text, p_permission_key text, p_is_enabled boolean, p_employee_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exists boolean;
BEGIN
  -- Check if permission exists
  SELECT EXISTS (
    SELECT 1 FROM public.permission_definitions WHERE permission_key = p_permission_key
  ) INTO v_exists;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'Permission key % does not exist', p_permission_key;
  END IF;

  -- Insert or update permission
  INSERT INTO public.role_permissions (store_id, role_name, permission_key, is_enabled, created_by, updated_by)
  VALUES (p_store_id, p_role_name, p_permission_key, p_is_enabled, p_employee_id, p_employee_id)
  ON CONFLICT (store_id, role_name, permission_key)
  DO UPDATE SET
    is_enabled = p_is_enabled,
    updated_by = p_employee_id,
    updated_at = now();

  RETURN true;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_employee_pin(pin_input text)
 RETURNS TABLE(employee_id uuid, display_name text, role text[], can_reset_pin boolean, store_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    e.id as employee_id,
    e.display_name,
    e.role,
    e.can_reset_pin,
    NULL::uuid as store_id
  FROM employees e
  WHERE LOWER(e.status) = 'active'
    AND e.pin_code_hash IS NOT NULL
    AND e.pin_code_hash = extensions.crypt(pin_input, e.pin_code_hash)
  LIMIT 1;
END;
$function$
;

grant delete on table "public"."app_versions" to "anon";

grant insert on table "public"."app_versions" to "anon";

grant references on table "public"."app_versions" to "anon";

grant select on table "public"."app_versions" to "anon";

grant trigger on table "public"."app_versions" to "anon";

grant truncate on table "public"."app_versions" to "anon";

grant update on table "public"."app_versions" to "anon";

grant delete on table "public"."app_versions" to "authenticated";

grant insert on table "public"."app_versions" to "authenticated";

grant references on table "public"."app_versions" to "authenticated";

grant select on table "public"."app_versions" to "authenticated";

grant trigger on table "public"."app_versions" to "authenticated";

grant truncate on table "public"."app_versions" to "authenticated";

grant update on table "public"."app_versions" to "authenticated";

grant delete on table "public"."app_versions" to "service_role";

grant insert on table "public"."app_versions" to "service_role";

grant references on table "public"."app_versions" to "service_role";

grant select on table "public"."app_versions" to "service_role";

grant trigger on table "public"."app_versions" to "service_role";

grant truncate on table "public"."app_versions" to "service_role";

grant update on table "public"."app_versions" to "service_role";

grant delete on table "public"."approval_status_correction_audit" to "anon";

grant insert on table "public"."approval_status_correction_audit" to "anon";

grant references on table "public"."approval_status_correction_audit" to "anon";

grant select on table "public"."approval_status_correction_audit" to "anon";

grant trigger on table "public"."approval_status_correction_audit" to "anon";

grant truncate on table "public"."approval_status_correction_audit" to "anon";

grant update on table "public"."approval_status_correction_audit" to "anon";

grant delete on table "public"."approval_status_correction_audit" to "authenticated";

grant insert on table "public"."approval_status_correction_audit" to "authenticated";

grant references on table "public"."approval_status_correction_audit" to "authenticated";

grant select on table "public"."approval_status_correction_audit" to "authenticated";

grant trigger on table "public"."approval_status_correction_audit" to "authenticated";

grant truncate on table "public"."approval_status_correction_audit" to "authenticated";

grant update on table "public"."approval_status_correction_audit" to "authenticated";

grant delete on table "public"."approval_status_correction_audit" to "service_role";

grant insert on table "public"."approval_status_correction_audit" to "service_role";

grant references on table "public"."approval_status_correction_audit" to "service_role";

grant select on table "public"."approval_status_correction_audit" to "service_role";

grant trigger on table "public"."approval_status_correction_audit" to "service_role";

grant truncate on table "public"."approval_status_correction_audit" to "service_role";

grant update on table "public"."approval_status_correction_audit" to "service_role";

grant delete on table "public"."auto_approval_runs" to "anon";

grant insert on table "public"."auto_approval_runs" to "anon";

grant references on table "public"."auto_approval_runs" to "anon";

grant select on table "public"."auto_approval_runs" to "anon";

grant trigger on table "public"."auto_approval_runs" to "anon";

grant truncate on table "public"."auto_approval_runs" to "anon";

grant update on table "public"."auto_approval_runs" to "anon";

grant delete on table "public"."auto_approval_runs" to "authenticated";

grant insert on table "public"."auto_approval_runs" to "authenticated";

grant references on table "public"."auto_approval_runs" to "authenticated";

grant select on table "public"."auto_approval_runs" to "authenticated";

grant trigger on table "public"."auto_approval_runs" to "authenticated";

grant truncate on table "public"."auto_approval_runs" to "authenticated";

grant update on table "public"."auto_approval_runs" to "authenticated";

grant delete on table "public"."auto_approval_runs" to "service_role";

grant insert on table "public"."auto_approval_runs" to "service_role";

grant references on table "public"."auto_approval_runs" to "service_role";

grant select on table "public"."auto_approval_runs" to "service_role";

grant trigger on table "public"."auto_approval_runs" to "service_role";

grant truncate on table "public"."auto_approval_runs" to "service_role";

grant update on table "public"."auto_approval_runs" to "service_role";

grant delete on table "public"."client_color_history" to "anon";

grant insert on table "public"."client_color_history" to "anon";

grant references on table "public"."client_color_history" to "anon";

grant select on table "public"."client_color_history" to "anon";

grant trigger on table "public"."client_color_history" to "anon";

grant truncate on table "public"."client_color_history" to "anon";

grant update on table "public"."client_color_history" to "anon";

grant delete on table "public"."client_color_history" to "authenticated";

grant insert on table "public"."client_color_history" to "authenticated";

grant references on table "public"."client_color_history" to "authenticated";

grant select on table "public"."client_color_history" to "authenticated";

grant trigger on table "public"."client_color_history" to "authenticated";

grant truncate on table "public"."client_color_history" to "authenticated";

grant update on table "public"."client_color_history" to "authenticated";

grant delete on table "public"."client_color_history" to "service_role";

grant insert on table "public"."client_color_history" to "service_role";

grant references on table "public"."client_color_history" to "service_role";

grant select on table "public"."client_color_history" to "service_role";

grant trigger on table "public"."client_color_history" to "service_role";

grant truncate on table "public"."client_color_history" to "service_role";

grant update on table "public"."client_color_history" to "service_role";

grant delete on table "public"."end_of_day_records" to "anon";

grant insert on table "public"."end_of_day_records" to "anon";

grant references on table "public"."end_of_day_records" to "anon";

grant select on table "public"."end_of_day_records" to "anon";

grant trigger on table "public"."end_of_day_records" to "anon";

grant truncate on table "public"."end_of_day_records" to "anon";

grant update on table "public"."end_of_day_records" to "anon";

grant delete on table "public"."end_of_day_records" to "authenticated";

grant insert on table "public"."end_of_day_records" to "authenticated";

grant references on table "public"."end_of_day_records" to "authenticated";

grant select on table "public"."end_of_day_records" to "authenticated";

grant trigger on table "public"."end_of_day_records" to "authenticated";

grant truncate on table "public"."end_of_day_records" to "authenticated";

grant update on table "public"."end_of_day_records" to "authenticated";

grant delete on table "public"."end_of_day_records" to "service_role";

grant insert on table "public"."end_of_day_records" to "service_role";

grant references on table "public"."end_of_day_records" to "service_role";

grant select on table "public"."end_of_day_records" to "service_role";

grant trigger on table "public"."end_of_day_records" to "service_role";

grant truncate on table "public"."end_of_day_records" to "service_role";

grant update on table "public"."end_of_day_records" to "service_role";

grant delete on table "public"."function_error_logs" to "anon";

grant insert on table "public"."function_error_logs" to "anon";

grant references on table "public"."function_error_logs" to "anon";

grant select on table "public"."function_error_logs" to "anon";

grant trigger on table "public"."function_error_logs" to "anon";

grant truncate on table "public"."function_error_logs" to "anon";

grant update on table "public"."function_error_logs" to "anon";

grant delete on table "public"."function_error_logs" to "authenticated";

grant insert on table "public"."function_error_logs" to "authenticated";

grant references on table "public"."function_error_logs" to "authenticated";

grant select on table "public"."function_error_logs" to "authenticated";

grant trigger on table "public"."function_error_logs" to "authenticated";

grant truncate on table "public"."function_error_logs" to "authenticated";

grant update on table "public"."function_error_logs" to "authenticated";

grant delete on table "public"."function_error_logs" to "service_role";

grant insert on table "public"."function_error_logs" to "service_role";

grant references on table "public"."function_error_logs" to "service_role";

grant select on table "public"."function_error_logs" to "service_role";

grant trigger on table "public"."function_error_logs" to "service_role";

grant truncate on table "public"."function_error_logs" to "service_role";

grant update on table "public"."function_error_logs" to "service_role";

grant delete on table "public"."inventory_approval_audit_log" to "anon";

grant insert on table "public"."inventory_approval_audit_log" to "anon";

grant references on table "public"."inventory_approval_audit_log" to "anon";

grant select on table "public"."inventory_approval_audit_log" to "anon";

grant trigger on table "public"."inventory_approval_audit_log" to "anon";

grant truncate on table "public"."inventory_approval_audit_log" to "anon";

grant update on table "public"."inventory_approval_audit_log" to "anon";

grant delete on table "public"."inventory_approval_audit_log" to "authenticated";

grant insert on table "public"."inventory_approval_audit_log" to "authenticated";

grant references on table "public"."inventory_approval_audit_log" to "authenticated";

grant select on table "public"."inventory_approval_audit_log" to "authenticated";

grant trigger on table "public"."inventory_approval_audit_log" to "authenticated";

grant truncate on table "public"."inventory_approval_audit_log" to "authenticated";

grant update on table "public"."inventory_approval_audit_log" to "authenticated";

grant delete on table "public"."inventory_approval_audit_log" to "service_role";

grant insert on table "public"."inventory_approval_audit_log" to "service_role";

grant references on table "public"."inventory_approval_audit_log" to "service_role";

grant select on table "public"."inventory_approval_audit_log" to "service_role";

grant trigger on table "public"."inventory_approval_audit_log" to "service_role";

grant truncate on table "public"."inventory_approval_audit_log" to "service_role";

grant update on table "public"."inventory_approval_audit_log" to "service_role";

grant delete on table "public"."inventory_audit_items" to "anon";

grant insert on table "public"."inventory_audit_items" to "anon";

grant references on table "public"."inventory_audit_items" to "anon";

grant select on table "public"."inventory_audit_items" to "anon";

grant trigger on table "public"."inventory_audit_items" to "anon";

grant truncate on table "public"."inventory_audit_items" to "anon";

grant update on table "public"."inventory_audit_items" to "anon";

grant delete on table "public"."inventory_audit_items" to "authenticated";

grant insert on table "public"."inventory_audit_items" to "authenticated";

grant references on table "public"."inventory_audit_items" to "authenticated";

grant select on table "public"."inventory_audit_items" to "authenticated";

grant trigger on table "public"."inventory_audit_items" to "authenticated";

grant truncate on table "public"."inventory_audit_items" to "authenticated";

grant update on table "public"."inventory_audit_items" to "authenticated";

grant delete on table "public"."inventory_audit_items" to "service_role";

grant insert on table "public"."inventory_audit_items" to "service_role";

grant references on table "public"."inventory_audit_items" to "service_role";

grant select on table "public"."inventory_audit_items" to "service_role";

grant trigger on table "public"."inventory_audit_items" to "service_role";

grant truncate on table "public"."inventory_audit_items" to "service_role";

grant update on table "public"."inventory_audit_items" to "service_role";

grant delete on table "public"."inventory_audits" to "anon";

grant insert on table "public"."inventory_audits" to "anon";

grant references on table "public"."inventory_audits" to "anon";

grant select on table "public"."inventory_audits" to "anon";

grant trigger on table "public"."inventory_audits" to "anon";

grant truncate on table "public"."inventory_audits" to "anon";

grant update on table "public"."inventory_audits" to "anon";

grant delete on table "public"."inventory_audits" to "authenticated";

grant insert on table "public"."inventory_audits" to "authenticated";

grant references on table "public"."inventory_audits" to "authenticated";

grant select on table "public"."inventory_audits" to "authenticated";

grant trigger on table "public"."inventory_audits" to "authenticated";

grant truncate on table "public"."inventory_audits" to "authenticated";

grant update on table "public"."inventory_audits" to "authenticated";

grant delete on table "public"."inventory_audits" to "service_role";

grant insert on table "public"."inventory_audits" to "service_role";

grant references on table "public"."inventory_audits" to "service_role";

grant select on table "public"."inventory_audits" to "service_role";

grant trigger on table "public"."inventory_audits" to "service_role";

grant truncate on table "public"."inventory_audits" to "service_role";

grant update on table "public"."inventory_audits" to "service_role";

grant delete on table "public"."store_product_purchase_units" to "anon";

grant insert on table "public"."store_product_purchase_units" to "anon";

grant references on table "public"."store_product_purchase_units" to "anon";

grant select on table "public"."store_product_purchase_units" to "anon";

grant trigger on table "public"."store_product_purchase_units" to "anon";

grant truncate on table "public"."store_product_purchase_units" to "anon";

grant update on table "public"."store_product_purchase_units" to "anon";

grant delete on table "public"."store_product_purchase_units" to "authenticated";

grant insert on table "public"."store_product_purchase_units" to "authenticated";

grant references on table "public"."store_product_purchase_units" to "authenticated";

grant select on table "public"."store_product_purchase_units" to "authenticated";

grant trigger on table "public"."store_product_purchase_units" to "authenticated";

grant truncate on table "public"."store_product_purchase_units" to "authenticated";

grant update on table "public"."store_product_purchase_units" to "authenticated";

grant delete on table "public"."store_product_purchase_units" to "service_role";

grant insert on table "public"."store_product_purchase_units" to "service_role";

grant references on table "public"."store_product_purchase_units" to "service_role";

grant select on table "public"."store_product_purchase_units" to "service_role";

grant trigger on table "public"."store_product_purchase_units" to "service_role";

grant truncate on table "public"."store_product_purchase_units" to "service_role";

grant update on table "public"."store_product_purchase_units" to "service_role";


  create policy "Allow anon delete from app_settings"
  on "public"."app_settings"
  as permissive
  for delete
  to anon
using (true);



  create policy "Allow anon insert to app_settings"
  on "public"."app_settings"
  as permissive
  for insert
  to anon
with check (true);



  create policy "Allow anon read access to app_settings"
  on "public"."app_settings"
  as permissive
  for select
  to anon
using (true);



  create policy "Allow anon update to app_settings"
  on "public"."app_settings"
  as permissive
  for update
  to anon
using (true)
with check (true);



  create policy "Allow anon insert to app_settings_audit"
  on "public"."app_settings_audit"
  as permissive
  for insert
  to anon
with check (true);



  create policy "Allow anon read access to app_settings_audit"
  on "public"."app_settings_audit"
  as permissive
  for select
  to anon
using (true);



  create policy "Admins can delete versions"
  on "public"."app_versions"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = ( SELECT auth.uid() AS uid)) AND ('Admin'::text = ANY (employees.role))))));



  create policy "Admins can insert versions"
  on "public"."app_versions"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = ( SELECT auth.uid() AS uid)) AND ('Admin'::text = ANY (employees.role))))));



  create policy "Admins can update versions"
  on "public"."app_versions"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = ( SELECT auth.uid() AS uid)) AND ('Admin'::text = ANY (employees.role))))));



  create policy "Users can view versions"
  on "public"."app_versions"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can read approval corrections audit"
  on "public"."approval_status_correction_audit"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Allow all access to create proposals"
  on "public"."attendance_change_proposals"
  as permissive
  for insert
  to public
with check (true);



  create policy "Allow all access to delete proposals"
  on "public"."attendance_change_proposals"
  as permissive
  for delete
  to public
using (true);



  create policy "Allow all access to update proposals"
  on "public"."attendance_change_proposals"
  as permissive
  for update
  to public
using (true)
with check (true);



  create policy "Allow all access to view proposals"
  on "public"."attendance_change_proposals"
  as permissive
  for select
  to public
using (true);



  create policy "Allow all to attendance_change_proposals"
  on "public"."attendance_change_proposals"
  as permissive
  for all
  to anon, authenticated
using (true)
with check (true);



  create policy "Users can create comments in their store"
  on "public"."attendance_comments"
  as permissive
  for insert
  to authenticated
with check (((employee_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (public.attendance_records ar
     JOIN public.employee_stores es ON ((es.employee_id = auth.uid())))
  WHERE ((ar.id = attendance_comments.attendance_record_id) AND (ar.store_id = es.store_id))))));



  create policy "Users can delete own comments"
  on "public"."attendance_comments"
  as permissive
  for delete
  to authenticated
using ((employee_id = auth.uid()));



  create policy "Users can update own comments"
  on "public"."attendance_comments"
  as permissive
  for update
  to authenticated
using ((employee_id = auth.uid()))
with check ((employee_id = auth.uid()));



  create policy "Users can view comments in their store"
  on "public"."attendance_comments"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.attendance_records ar
     JOIN public.employee_stores es ON ((es.employee_id = auth.uid())))
  WHERE ((ar.id = attendance_comments.attendance_record_id) AND (ar.store_id = es.store_id)))));



  create policy "Authenticated users can insert auto-approval runs"
  on "public"."auto_approval_runs"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Edge function can insert auto-approval runs"
  on "public"."auto_approval_runs"
  as permissive
  for insert
  to anon
with check (true);



  create policy "Managers and above can view auto-approval runs"
  on "public"."auto_approval_runs"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees e
  WHERE ((e.id = ( SELECT auth.uid() AS uid)) AND (('Manager'::text = ANY (e.role)) OR ('Admin'::text = ANY (e.role)) OR ('Owner'::text = ANY (e.role)))))));



  create policy "Allow authenticated to create proposals"
  on "public"."cash_transaction_change_proposals"
  as permissive
  for insert
  to authenticated, anon
with check (true);



  create policy "Allow authenticated to update proposals"
  on "public"."cash_transaction_change_proposals"
  as permissive
  for update
  to authenticated, anon
using (true)
with check (true);



  create policy "Allow authenticated to view proposals"
  on "public"."cash_transaction_change_proposals"
  as permissive
  for select
  to authenticated, anon
using (true);



  create policy "Allow insert of edit history"
  on "public"."cash_transaction_edit_history"
  as permissive
  for insert
  to authenticated, anon
with check (true);



  create policy "Anon users can view edit history for their store"
  on "public"."cash_transaction_edit_history"
  as permissive
  for select
  to anon
using (true);



  create policy "Users can view edit history for their store"
  on "public"."cash_transaction_edit_history"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM ((public.cash_transactions ct
     JOIN public.employees e ON ((e.id = ( SELECT auth.uid() AS uid))))
     JOIN public.employee_stores es ON ((es.employee_id = e.id)))
  WHERE ((ct.id = cash_transaction_edit_history.transaction_id) AND (ct.store_id = es.store_id)))));



  create policy "Allow update cash transactions"
  on "public"."cash_transactions"
  as permissive
  for update
  to anon, authenticated
using (true);



  create policy "Allow view cash transactions"
  on "public"."cash_transactions"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Employees can only create transactions for assigned stores"
  on "public"."cash_transactions"
  as permissive
  for insert
  to anon, authenticated
with check (public.check_employee_store_access(created_by_id, store_id));



  create policy "Allow all access to client_color_history"
  on "public"."client_color_history"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Employees can view own inventory"
  on "public"."employee_inventory"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Managers can insert employee inventory"
  on "public"."employee_inventory"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Managers can update employee inventory"
  on "public"."employee_inventory"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Managers can create employee inventory lots"
  on "public"."employee_inventory_lots"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Managers can delete employee inventory lots"
  on "public"."employee_inventory_lots"
  as permissive
  for delete
  to anon, authenticated
using (true);



  create policy "Managers can update employee inventory lots"
  on "public"."employee_inventory_lots"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Users can view employee inventory lots"
  on "public"."employee_inventory_lots"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Allow anon delete employee services"
  on "public"."employee_services"
  as permissive
  for delete
  to anon
using (true);



  create policy "Allow anon insert employee services"
  on "public"."employee_services"
  as permissive
  for insert
  to anon
with check (true);



  create policy "Allow authenticated delete employee services"
  on "public"."employee_services"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "Allow authenticated insert employee services"
  on "public"."employee_services"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Anonymous users can view employee services"
  on "public"."employee_services"
  as permissive
  for select
  to anon
using (true);



  create policy "Authenticated users can view employee services"
  on "public"."employee_services"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can view employee stores"
  on "public"."employee_stores"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can view own store associations"
  on "public"."employee_stores"
  as permissive
  for select
  to anon
using (true);



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



  create policy "Authenticated users can insert end_of_day_records"
  on "public"."end_of_day_records"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Authenticated users can read end_of_day_records"
  on "public"."end_of_day_records"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can update end_of_day_records"
  on "public"."end_of_day_records"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "Allow insert error logs"
  on "public"."function_error_logs"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow view error logs"
  on "public"."function_error_logs"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Authenticated users can insert audit records"
  on "public"."inventory_approval_audit_log"
  as permissive
  for insert
  to anon
with check (true);



  create policy "Managers can view audit records"
  on "public"."inventory_approval_audit_log"
  as permissive
  for select
  to anon
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.id = ( SELECT auth.uid() AS uid)) AND ('manager'::text = ANY (employees.role)) AND (employees.status = 'active'::text)))));



  create policy "Managers can create audit items"
  on "public"."inventory_audit_items"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Managers can update audit items"
  on "public"."inventory_audit_items"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Users can view audit items"
  on "public"."inventory_audit_items"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Managers can create audits"
  on "public"."inventory_audits"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Managers can update audits"
  on "public"."inventory_audits"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Users can view audits"
  on "public"."inventory_audits"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Managers can create distributions"
  on "public"."inventory_distributions"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Users can update distributions"
  on "public"."inventory_distributions"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Users can view distributions"
  on "public"."inventory_distributions"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Users can create inventory items"
  on "public"."inventory_items"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Users can delete inventory items"
  on "public"."inventory_items"
  as permissive
  for delete
  to anon, authenticated
using (true);



  create policy "Users can update inventory items"
  on "public"."inventory_items"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Users can view inventory items"
  on "public"."inventory_items"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Managers can create lots"
  on "public"."inventory_purchase_lots"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Managers can update lots"
  on "public"."inventory_purchase_lots"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Users can view inventory purchase lots"
  on "public"."inventory_purchase_lots"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Allow insert inventory transaction items"
  on "public"."inventory_transaction_items"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow update inventory transaction items"
  on "public"."inventory_transaction_items"
  as permissive
  for update
  to anon, authenticated
using (true);



  create policy "Allow view inventory transaction items"
  on "public"."inventory_transaction_items"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Allow insert inventory transactions"
  on "public"."inventory_transactions"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow update inventory transactions"
  on "public"."inventory_transactions"
  as permissive
  for update
  to anon, authenticated
using (true);



  create policy "Allow view inventory transactions"
  on "public"."inventory_transactions"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Anyone can read permission definitions"
  on "public"."permission_definitions"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Employees and management can view removal records"
  on "public"."queue_removals_log"
  as permissive
  for select
  to authenticated
using (((employee_id = ( SELECT auth.uid() AS uid)) OR (store_id IN ( SELECT es.store_id
   FROM (public.employee_stores es
     JOIN public.employees e ON ((e.id = es.employee_id)))
  WHERE ((es.employee_id = ( SELECT auth.uid() AS uid)) AND (e.role && ARRAY['manager'::text, 'owner'::text, 'admin'::text]))))));



  create policy "Management can create removal records"
  on "public"."queue_removals_log"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM (public.employees e
     JOIN public.employee_stores es ON ((e.id = es.employee_id)))
  WHERE ((e.id = auth.uid()) AND (es.store_id = queue_removals_log.store_id) AND (e.role && ARRAY['Manager'::text, 'Supervisor'::text, 'Admin'::text, 'Owner'::text])))));



  create policy "Allow anon to view actions"
  on "public"."queue_violation_actions"
  as permissive
  for select
  to anon
using (true);



  create policy "Managers can create actions"
  on "public"."queue_violation_actions"
  as permissive
  for insert
  to anon
with check (true);



  create policy "Allow anon to view reports where they are involved"
  on "public"."queue_violation_reports"
  as permissive
  for select
  to anon
using (true);



  create policy "Employees can create reports"
  on "public"."queue_violation_reports"
  as permissive
  for insert
  to anon
with check ((EXISTS ( SELECT 1
   FROM public.employee_stores
  WHERE ((employee_stores.employee_id = queue_violation_reports.reporter_employee_id) AND (employee_stores.store_id = queue_violation_reports.store_id)))));



  create policy "Employees can view reports where they are involved"
  on "public"."queue_violation_reports"
  as permissive
  for select
  to authenticated
using (((reporter_employee_id = ( SELECT auth.uid() AS uid)) OR (reported_employee_id = ( SELECT auth.uid() AS uid)) OR (( SELECT auth.uid() AS uid) = ANY (required_responder_ids)) OR (reviewed_by_employee_id = ( SELECT auth.uid() AS uid))));



  create policy "Managers can update reports for their stores"
  on "public"."queue_violation_reports"
  as permissive
  for update
  to anon
using (true)
with check (true);



  create policy "Allow anon to view responses"
  on "public"."queue_violation_responses"
  as permissive
  for select
  to anon
using (true);



  create policy "Employees can insert their own responses"
  on "public"."queue_violation_responses"
  as permissive
  for insert
  to anon
with check (true);



  create policy "Employees can view their own responses"
  on "public"."queue_violation_responses"
  as permissive
  for select
  to authenticated
using ((employee_id = ( SELECT auth.uid() AS uid)));



  create policy "Admin and Owner can insert role permissions"
  on "public"."role_permissions"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM (public.employees e
     JOIN public.employee_stores es ON ((e.id = es.employee_id)))
  WHERE ((e.id = ( SELECT auth.uid() AS uid)) AND (es.store_id = role_permissions.store_id) AND ((e.role @> ARRAY['Admin'::text]) OR (e.role @> ARRAY['Owner'::text]))))));



  create policy "Admin and Owner can update role permissions"
  on "public"."role_permissions"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM (public.employees e
     JOIN public.employee_stores es ON ((e.id = es.employee_id)))
  WHERE ((e.id = ( SELECT auth.uid() AS uid)) AND (es.store_id = role_permissions.store_id) AND ((e.role @> ARRAY['Admin'::text]) OR (e.role @> ARRAY['Owner'::text]))))))
with check ((EXISTS ( SELECT 1
   FROM (public.employees e
     JOIN public.employee_stores es ON ((e.id = es.employee_id)))
  WHERE ((e.id = ( SELECT auth.uid() AS uid)) AND (es.store_id = role_permissions.store_id) AND ((e.role @> ARRAY['Admin'::text]) OR (e.role @> ARRAY['Owner'::text]))))));



  create policy "Users can read role permissions for their stores"
  on "public"."role_permissions"
  as permissive
  for select
  to authenticated
using ((store_id IN ( SELECT es.store_id
   FROM public.employee_stores es
  WHERE (es.employee_id = ( SELECT auth.uid() AS uid)))));



  create policy "System can insert audit logs"
  on "public"."role_permissions_audit"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Users can read audit logs for their stores"
  on "public"."role_permissions_audit"
  as permissive
  for select
  to authenticated
using ((store_id IN ( SELECT es.store_id
   FROM public.employee_stores es
  WHERE (es.employee_id = ( SELECT auth.uid() AS uid)))));



  create policy "Allow insert safe balance history"
  on "public"."safe_balance_history"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Allow update safe balance history"
  on "public"."safe_balance_history"
  as permissive
  for update
  to anon, authenticated
using (true);



  create policy "Allow view safe balance history"
  on "public"."safe_balance_history"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Admin, Manager, Supervisor, Owner can insert services"
  on "public"."services"
  as permissive
  for insert
  to anon, authenticated
with check ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (('Admin'::text = ANY (employees.role)) OR ('Manager'::text = ANY (employees.role)) OR ('Supervisor'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role))) AND (employees.status = 'Active'::text)))));



  create policy "Admin, Manager, Supervisor, Owner can update services"
  on "public"."services"
  as permissive
  for update
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (('Admin'::text = ANY (employees.role)) OR ('Manager'::text = ANY (employees.role)) OR ('Supervisor'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role))) AND (employees.status = 'Active'::text)))));



  create policy "All users can view services"
  on "public"."services"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Only Admin can delete services"
  on "public"."services"
  as permissive
  for delete
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (('Admin'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role))) AND (employees.status = 'Active'::text)))));



  create policy "Users can create product preferences"
  on "public"."store_product_preferences"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Users can update product preferences"
  on "public"."store_product_preferences"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Users can view product preferences"
  on "public"."store_product_preferences"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Managers can create purchase units"
  on "public"."store_product_purchase_units"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Managers can delete purchase units"
  on "public"."store_product_purchase_units"
  as permissive
  for delete
  to anon, authenticated
using (true);



  create policy "Managers can update purchase units"
  on "public"."store_product_purchase_units"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Users can view purchase units"
  on "public"."store_product_purchase_units"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Staff can create service categories"
  on "public"."store_service_categories"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "Staff can delete service categories"
  on "public"."store_service_categories"
  as permissive
  for delete
  to anon, authenticated
using (true);



  create policy "Staff can update service categories"
  on "public"."store_service_categories"
  as permissive
  for update
  to anon, authenticated
using (true)
with check (true);



  create policy "Users can view service categories"
  on "public"."store_service_categories"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Admin, Manager, Supervisor can manage store services"
  on "public"."store_services"
  as permissive
  for all
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (('Admin'::text = ANY (employees.role)) OR ('Manager'::text = ANY (employees.role)) OR ('Supervisor'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role))) AND (employees.status = 'Active'::text)))))
with check ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (('Admin'::text = ANY (employees.role)) OR ('Manager'::text = ANY (employees.role)) OR ('Supervisor'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role))) AND (employees.status = 'Active'::text)))));



  create policy "All users can view store services"
  on "public"."store_services"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Users can view store services"
  on "public"."store_services"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Users can view all stores"
  on "public"."stores"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Allow anonymous to insert activity logs"
  on "public"."ticket_activity_log"
  as permissive
  for insert
  to anon
with check (true);



  create policy "Allow anonymous to read activity logs"
  on "public"."ticket_activity_log"
  as permissive
  for select
  to anon
using (true);



  create policy "Allow all access to attendance_records"
  on "public"."attendance_records"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Allow all access to clients"
  on "public"."clients"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Allow all access to employees"
  on "public"."employees"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Allow all access to sale_tickets"
  on "public"."sale_tickets"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Admins can manage stores"
  on "public"."stores"
  as permissive
  for all
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.employees
  WHERE ((employees.pin_code_hash IS NOT NULL) AND (employees.status = 'Active'::text) AND (('Admin'::text = ANY (employees.role)) OR ('Manager'::text = ANY (employees.role)) OR ('Owner'::text = ANY (employees.role)))))));



  create policy "Allow all access to technician_ready_queue"
  on "public"."technician_ready_queue"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Allow all access to ticket_items"
  on "public"."ticket_items"
  as permissive
  for all
  to public
using (true)
with check (true);


CREATE TRIGGER update_attendance_change_proposals_updated_at BEFORE UPDATE ON public.attendance_change_proposals FOR EACH ROW EXECUTE FUNCTION public.update_attendance_change_proposals_updated_at();

CREATE TRIGGER validate_weekly_schedule_trigger BEFORE INSERT OR UPDATE OF weekly_schedule ON public.employees FOR EACH ROW EXECUTE FUNCTION public.validate_weekly_schedule();

CREATE TRIGGER trg_calculate_closing_cash_amount BEFORE INSERT OR UPDATE ON public.end_of_day_records FOR EACH ROW EXECUTE FUNCTION public.calculate_closing_cash_amount();

CREATE TRIGGER trg_calculate_opening_cash_amount BEFORE INSERT OR UPDATE ON public.end_of_day_records FOR EACH ROW EXECUTE FUNCTION public.calculate_opening_cash_amount();

CREATE TRIGGER auto_set_completed_at_trigger BEFORE UPDATE ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.auto_set_completed_at_on_close();

CREATE TRIGGER enforce_no_previous_unclosed_tickets BEFORE INSERT ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.validate_no_previous_unclosed_tickets();

CREATE TRIGGER ensure_approval_status_consistency BEFORE INSERT OR UPDATE ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.validate_approval_status_consistency();

CREATE TRIGGER ensure_opening_cash_before_ticket BEFORE INSERT ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.validate_opening_cash_before_ticket();

CREATE TRIGGER on_ticket_delete_update_queue BEFORE DELETE ON public.sale_tickets FOR EACH ROW EXECUTE FUNCTION public.handle_ticket_delete_queue_update();

CREATE TRIGGER trigger_ensure_single_default_purchase_unit BEFORE INSERT OR UPDATE ON public.store_product_purchase_units FOR EACH ROW EXECUTE FUNCTION public.ensure_single_default_purchase_unit();

CREATE TRIGGER ticket_items_auto_complete_previous AFTER INSERT ON public.ticket_items FOR EACH ROW EXECUTE FUNCTION public.auto_complete_previous_tickets();

CREATE TRIGGER ticket_items_mark_busy_on_update AFTER UPDATE OF employee_id ON public.ticket_items FOR EACH ROW EXECUTE FUNCTION public.trigger_mark_technician_busy_on_update();

CREATE TRIGGER trigger_auto_populate_started_at BEFORE INSERT ON public.ticket_items FOR EACH ROW EXECUTE FUNCTION public.auto_populate_ticket_item_started_at();

CREATE TRIGGER trigger_update_inventory_on_approval AFTER UPDATE ON public.inventory_transactions FOR EACH ROW EXECUTE FUNCTION public.update_inventory_on_transaction_approval();


