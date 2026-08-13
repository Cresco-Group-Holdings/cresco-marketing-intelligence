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
--   is set (we do not enable FORCE). Function owners retain EXECUTE on functions they own.
--
-- Function hardening:
--   RLS does not protect function execution. PostgreSQL grants EXECUTE on new functions
--   to PUBLIC by default. Revoke PUBLIC execute on all existing and future public functions.
--
-- service_role:
--   Has rolbypassrls = true but is only used server-side for Auth admin and Storage APIs
--   (auth.* and storage.* schemas). Public application grants are revoked here.

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

-- ---------------------------------------------------------------------------
-- 3. Revoke PUBLIC execute on all existing public functions (RLS does not apply)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Preserve schema USAGE for PostgREST introspection; object grants remain revoked.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Default privileges for objects created by postgres (Prisma migrations)
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 5. Event trigger: auto-enable RLS + revoke API-role grants on new public tables
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
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
    EXECUTE format(
      'REVOKE ALL ON TABLE %s FROM anon, authenticated, service_role',
      cmd.object_identity
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_public_table_rls() FROM PUBLIC, anon, authenticated, service_role;

DROP EVENT TRIGGER IF EXISTS trg_ensure_public_table_rls ON ddl_command_end;

CREATE EVENT TRIGGER trg_ensure_public_table_rls
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION public.ensure_public_table_rls();

-- ---------------------------------------------------------------------------
-- 6. Event trigger: revoke PUBLIC/API-role execute on new public functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_public_function_privileges()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cmd RECORD;
BEGIN
  FOR cmd IN
    SELECT object_identity
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE FUNCTION'
      AND schema_name = 'public'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',
      cmd.object_identity
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_public_function_privileges() FROM PUBLIC, anon, authenticated, service_role;

DROP EVENT TRIGGER IF EXISTS trg_ensure_public_function_privileges ON ddl_command_end;

CREATE EVENT TRIGGER trg_ensure_public_function_privileges
  ON ddl_command_end
  WHEN TAG IN ('CREATE FUNCTION')
  EXECUTE FUNCTION public.ensure_public_function_privileges();

-- ---------------------------------------------------------------------------
-- 7. _prisma_migrations — revoke API-role access (Prisma uses postgres table owner)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public._prisma_migrations FROM anon, authenticated, service_role';
  END IF;
END $$;
