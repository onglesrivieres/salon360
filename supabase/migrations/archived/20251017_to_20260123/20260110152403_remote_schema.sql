-- This migration was generated from a remote schema pull
-- To avoid schema drift issues, we'll skip destructive operations on store_service_categories
-- and let the creation migration handle the table setup

drop extension if exists "pg_net";

-- Note: store_service_categories table management is handled by later migrations
-- This prevents idempotency issues and schema drift errors

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


