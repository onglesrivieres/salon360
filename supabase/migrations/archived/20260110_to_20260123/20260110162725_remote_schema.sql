
-- Add missing color column if it doesn't exist (created in 20260110153000_create_store_service_categories.sql)
ALTER TABLE "public"."store_service_categories" ADD COLUMN IF NOT EXISTS "color" text NOT NULL DEFAULT 'pink';

alter table "public"."store_service_categories" enable row level security;

-- Create indexes with IF NOT EXISTS for idempotency
CREATE INDEX IF NOT EXISTS idx_store_service_categories_store_active ON public.store_service_categories USING btree (store_id, is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_store_service_categories_store_id ON public.store_service_categories USING btree (store_id);
CREATE UNIQUE INDEX IF NOT EXISTS store_service_categories_pkey ON public.store_service_categories USING btree (id);
CREATE UNIQUE INDEX IF NOT EXISTS store_service_categories_unique_name ON public.store_service_categories USING btree (store_id, name);

-- Add primary key constraint if it doesn't already exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
    AND table_name = 'store_service_categories'
    AND constraint_name = 'store_service_categories_pkey'
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE "public"."store_service_categories" ADD CONSTRAINT "store_service_categories_pkey" PRIMARY KEY USING INDEX "store_service_categories_pkey";
  END IF;
EXCEPTION WHEN others THEN NULL;
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

-- Add unique constraint if it doesn't already exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
    AND table_name = 'store_service_categories'
    AND constraint_name = 'store_service_categories_unique_name'
    AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE "public"."store_service_categories" ADD CONSTRAINT "store_service_categories_unique_name" UNIQUE USING INDEX "store_service_categories_unique_name";
  END IF;
EXCEPTION WHEN others THEN NULL;
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


-- Drop and recreate policies to ensure they match desired configuration
DROP POLICY IF EXISTS "Staff can create service categories" ON "public"."store_service_categories";
CREATE POLICY "Staff can create service categories"
  ON "public"."store_service_categories"
  AS PERMISSIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can delete service categories" ON "public"."store_service_categories";
CREATE POLICY "Staff can delete service categories"
  ON "public"."store_service_categories"
  AS PERMISSIVE
  FOR DELETE
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff can update service categories" ON "public"."store_service_categories";
CREATE POLICY "Staff can update service categories"
  ON "public"."store_service_categories"
  AS PERMISSIVE
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view service categories" ON "public"."store_service_categories";
CREATE POLICY "Users can view service categories"
  ON "public"."store_service_categories"
  AS PERMISSIVE
  FOR SELECT
  TO anon, authenticated
  USING (true);


DROP TRIGGER IF EXISTS trigger_store_service_categories_updated_at ON public.store_service_categories;
CREATE TRIGGER trigger_store_service_categories_updated_at BEFORE UPDATE ON public.store_service_categories FOR EACH ROW EXECUTE FUNCTION public.update_store_service_categories_updated_at();


