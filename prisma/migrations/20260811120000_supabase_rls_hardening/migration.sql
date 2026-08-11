-- Supabase RLS hardening for Cresco Marketing Intelligence
--
-- Architecture: application data is accessed exclusively through server-side Prisma.
-- Supabase client usage is limited to Auth and Storage (service role). The public schema
-- must not be reachable through PostgREST/Data API for anon or authenticated roles.
--
-- This migration:
--   1. Enables RLS on every existing public table (default deny for client roles)
--   2. Revokes anon/authenticated grants on tables, sequences, and functions
--   3. Sets default privileges so future Prisma-created objects stay locked down
--   4. Installs an event trigger to auto-enable RLS on newly created public tables
--
-- Prisma connects as the postgres superuser (or equivalent migration role) which bypasses RLS.
-- service_role also bypasses RLS and is server-only.

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on all existing public tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Revoke Data API access for client-facing roles
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Preserve schema USAGE so PostgREST can introspect; table-level grants remain revoked.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Default privileges for objects created by postgres (Prisma migrations)
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Event trigger: auto-enable RLS + revoke client grants on new public tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_public_table_rls()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cmd RECORD;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM anon, authenticated', cmd.object_identity);
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS trg_ensure_public_table_rls ON ddl_command_end;

CREATE EVENT TRIGGER trg_ensure_public_table_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.ensure_public_table_rls();

-- ---------------------------------------------------------------------------
-- 5. _prisma_migrations — revoke client access (Prisma uses postgres role)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated';
  END IF;
END $$;
