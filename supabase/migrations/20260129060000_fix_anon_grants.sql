-- ============================================================================
-- FIX: Grant full privileges to anon role
-- This is required because the app uses PIN auth without Supabase Auth,
-- so all API calls use the anon role JWT.
--
-- The squash_01 migration grants ALL on tables/sequences/functions that exist
-- at that point in time, but subsequent squash migrations (02-12) create new
-- tables and functions that never receive grants. This migration fixes that
-- by granting on ALL existing objects and setting DEFAULT PRIVILEGES for
-- any future objects.
-- ============================================================================

-- Grant full privileges on ALL existing tables (including SELECT)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Grant EXECUTE on ALL existing functions (needed for RPC calls like
-- check_in_employee, can_checkin_now, join_ready_queue_with_checkin, etc.)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Ensure future tables/sequences/functions also receive grants
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
