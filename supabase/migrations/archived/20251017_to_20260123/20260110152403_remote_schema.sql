drop extension if exists "pg_net";

drop trigger if exists "trigger_store_service_categories_updated_at" on "public"."store_service_categories";

drop policy "Staff can create service categories" on "public"."store_service_categories";

drop policy "Staff can delete service categories" on "public"."store_service_categories";

drop policy "Staff can update service categories" on "public"."store_service_categories";

drop policy "Users can view service categories" on "public"."store_service_categories";

revoke delete on table "public"."store_service_categories" from "anon";

revoke insert on table "public"."store_service_categories" from "anon";

revoke references on table "public"."store_service_categories" from "anon";

revoke select on table "public"."store_service_categories" from "anon";

revoke trigger on table "public"."store_service_categories" from "anon";

revoke truncate on table "public"."store_service_categories" from "anon";

revoke update on table "public"."store_service_categories" from "anon";

revoke delete on table "public"."store_service_categories" from "authenticated";

revoke insert on table "public"."store_service_categories" from "authenticated";

revoke references on table "public"."store_service_categories" from "authenticated";

revoke select on table "public"."store_service_categories" from "authenticated";

revoke trigger on table "public"."store_service_categories" from "authenticated";

revoke truncate on table "public"."store_service_categories" from "authenticated";

revoke update on table "public"."store_service_categories" from "authenticated";

revoke delete on table "public"."store_service_categories" from "service_role";

revoke insert on table "public"."store_service_categories" from "service_role";

revoke references on table "public"."store_service_categories" from "service_role";

revoke select on table "public"."store_service_categories" from "service_role";

revoke trigger on table "public"."store_service_categories" from "service_role";

revoke truncate on table "public"."store_service_categories" from "service_role";

revoke update on table "public"."store_service_categories" from "service_role";

alter table "public"."store_service_categories" drop constraint "store_service_categories_name_not_empty";

alter table "public"."store_service_categories" drop constraint "store_service_categories_store_id_fkey";

alter table "public"."store_service_categories" drop constraint "store_service_categories_unique_name";

drop function if exists "public"."update_store_service_categories_updated_at"();

alter table "public"."store_service_categories" drop constraint "store_service_categories_pkey";

drop index if exists "public"."idx_store_service_categories_store_active";

drop index if exists "public"."idx_store_service_categories_store_id";

drop index if exists "public"."store_service_categories_pkey";

drop index if exists "public"."store_service_categories_unique_name";

drop table "public"."store_service_categories";

set check_function_bodies = off;

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


