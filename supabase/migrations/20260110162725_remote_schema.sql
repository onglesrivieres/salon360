
-- Add missing color column if it doesn't exist (created in 20260110153000_create_store_service_categories.sql)
ALTER TABLE "public"."store_service_categories" ADD COLUMN IF NOT EXISTS "color" text NOT NULL DEFAULT 'pink';

alter table "public"."store_service_categories" enable row level security;

DO $$ BEGIN
  CREATE INDEX idx_store_service_categories_store_active ON public.store_service_categories USING btree (store_id, is_active) WHERE (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX idx_store_service_categories_store_id ON public.store_service_categories USING btree (store_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX store_service_categories_pkey ON public.store_service_categories USING btree (id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX store_service_categories_unique_name ON public.store_service_categories USING btree (store_id, name);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."store_service_categories" ADD CONSTRAINT "store_service_categories_pkey" PRIMARY KEY USING INDEX "store_service_categories_pkey";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."store_service_categories" ADD CONSTRAINT "store_service_categories_name_not_empty" CHECK ((name <> ''::text)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."store_service_categories" VALIDATE CONSTRAINT "store_service_categories_name_not_empty";
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."store_service_categories" ADD CONSTRAINT "store_service_categories_store_id_fkey" FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."store_service_categories" VALIDATE CONSTRAINT "store_service_categories_store_id_fkey";
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "public"."store_service_categories" ADD CONSTRAINT "store_service_categories_unique_name" UNIQUE USING INDEX "store_service_categories_unique_name";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_store_service_categories_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$
;

-- Minimal read-only access for anon role
grant select on table "public"."store_service_categories" to "anon";

grant delete on table "public"."store_service_categories" to "authenticated";

grant insert on table "public"."store_service_categories" to "authenticated";

grant references on table "public"."store_service_categories" to "authenticated";

grant select on table "public"."store_service_categories" to "authenticated";

grant update on table "public"."store_service_categories" to "authenticated";

grant delete on table "public"."store_service_categories" to "service_role";

grant insert on table "public"."store_service_categories" to "service_role";

grant references on table "public"."store_service_categories" to "service_role";

grant select on table "public"."store_service_categories" to "service_role";

grant trigger on table "public"."store_service_categories" to "service_role";

grant truncate on table "public"."store_service_categories" to "service_role";

grant update on table "public"."store_service_categories" to "service_role";


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


DROP TRIGGER IF EXISTS trigger_store_service_categories_updated_at ON public.store_service_categories;
CREATE TRIGGER trigger_store_service_categories_updated_at BEFORE UPDATE ON public.store_service_categories FOR EACH ROW EXECUTE FUNCTION public.update_store_service_categories_updated_at();


