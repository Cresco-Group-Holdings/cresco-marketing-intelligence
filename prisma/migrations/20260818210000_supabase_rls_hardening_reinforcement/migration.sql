-- Supabase RLS hardening reinforcement (idempotent)
--
-- Production may still report "RLS Disabled in Public" when the original hardening
-- migration (20260811120000) has not been deployed, or when Supabase default grants
-- to PUBLIC were re-applied outside Prisma migrations.
--
-- This migration is safe to run multiple times. It does not create permissive policies,
-- does not enable FORCE ROW LEVEL SECURITY (Prisma postgres owner bypass preserved),
-- and does not change application behaviour.

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on all existing public tables (idempotent)
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
-- 2. Revoke PUBLIC grants on tables and sequences (defense-in-depth)
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 3. Revoke Data API access for PostgREST-facing roles (when present)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', api_role);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Revoke PUBLIC execute on all existing public functions
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 5. Default privileges: block PUBLIC and API-role grants on future objects
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
        api_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
        api_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Update event trigger: also revoke PUBLIC on new public tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_public_table_rls()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cmd RECORD;
  api_role text;
BEGIN
  FOR cmd IN
    SELECT object_identity, schema_name
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag = 'CREATE TABLE'
      AND schema_name = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC', cmd.object_identity);
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format('REVOKE ALL ON TABLE %s FROM %I', cmd.object_identity, api_role);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_public_table_rls() FROM PUBLIC;

DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.ensure_public_table_rls() FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7. _prisma_migrations — must remain server-only (Prisma DIRECT_URL)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  api_role text;
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'REVOKE ALL ON TABLE public._prisma_migrations FROM PUBLIC';
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format(
          'REVOKE ALL ON TABLE public._prisma_migrations FROM %I',
          api_role
        );
      END IF;
    END LOOP;
  END IF;
END $$;
