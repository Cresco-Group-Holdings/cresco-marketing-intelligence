-- Supabase RLS reconciliation (idempotent)
--
-- Re-applies the deny-by-default posture after migrations that created tables between
-- 20260811120000_supabase_rls_hardening and this migration. Safe to run on Supabase production
-- and vanilla PostgreSQL CI (API roles are optional).

-- ---------------------------------------------------------------------------
-- 1. Organisation membership helper (for audits / future policies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_organisation_member(
  p_organisation_id text,
  p_user_profile_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "OrganisationMembership" om
    WHERE om."organisationId" = p_organisation_id
      AND om."userId" = p_user_profile_id
      AND om.status = 'ACTIVE'::"MembershipStatus"
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_organisation_member(text, text) FROM PUBLIC;

DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.is_organisation_member(text, text) FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Ensure RLS is enabled on every public table
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT c.relname AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Re-revoke API-role grants (tables, sequences, functions)
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
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', api_role);
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 4. _prisma_migrations hardening (idempotent)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  api_role text;
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY';
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
