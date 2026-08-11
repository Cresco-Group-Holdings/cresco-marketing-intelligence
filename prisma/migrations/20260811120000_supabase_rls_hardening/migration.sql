-- Supabase RLS hardening for Cresco Marketing Intelligence
--
-- Architecture: application data is accessed exclusively through server-side Prisma.
-- Supabase client usage is limited to Auth (anon/authenticated JWT) and Storage (service_role).
-- The public schema must not be reachable through PostgREST/Data API for any API role.
--
-- Prisma compatibility:
--   Supabase `postgres` is NOT a PostgreSQL superuser (rolsuper = false).
--   Prisma migrations and runtime queries connect as `postgres`, which OWNS application
--   tables created in public. Table owners bypass RLS unless FORCE ROW LEVEL SECURITY
--   is set (we do not enable FORCE).
--
-- service_role:
--   Has rolbypassrls = true but is only used server-side for Auth admin and Storage APIs
--   (auth.* and storage.* schemas). Public application-table grants are revoked here.

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
-- 2. Revoke Data API access for all PostgREST-facing roles
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, service_role;

-- Preserve schema USAGE for PostgREST introspection; table-level grants remain revoked.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Default privileges for objects created by postgres (Prisma migrations)
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Event trigger: auto-enable RLS + revoke API-role grants on new public tables
--    - Fires only on CREATE TABLE in public (not auth/storage/system schemas)
--    - ALTER TABLE / REVOKE do not re-fire CREATE TABLE (no recursion)
--    - object_identity comes from pg_event_trigger_ddl_commands() (catalog-safe)
--    - SECURITY DEFINER + fixed search_path prevents search_path injection
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_public_table_rls()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cmd RECORD;
BEGIN
  FOR cmd IN
    SELECT object_identity, schema_name
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
  LOOP
    -- object_identity is a fully-qualified regclass text from the system catalog.
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
    EXECUTE format(
      'REVOKE ALL ON TABLE %s FROM anon, authenticated, service_role',
      cmd.object_identity
    );
  END LOOP;
END;
$$;

DROP EVENT TRIGGER IF EXISTS trg_ensure_public_table_rls ON ddl_command_end;

CREATE EVENT TRIGGER trg_ensure_public_table_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.ensure_public_table_rls();

-- ---------------------------------------------------------------------------
-- 5. _prisma_migrations — revoke API-role access (Prisma uses postgres table owner)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated, service_role';
  END IF;
END $$;
