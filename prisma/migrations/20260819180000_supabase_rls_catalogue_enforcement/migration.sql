-- P0 corrective migration: catalogue-driven RLS enforcement
--
-- Previous migrations (20260811120000, 20260818120000) used the same ALTER TABLE pattern but
-- production pg_class shows relrowsecurity=false for all public tables — meaning those migrations
-- were never executed against the live Supabase database (or the database was restored without
-- re-running them). _prisma_migrations rows alone are not proof of execution.
--
-- This migration:
--   1. Discovers ordinary public tables from pg_class (not pg_tables).
--   2. Enables RLS on every table where relrowsecurity=false.
--   3. FAILS the migration transaction if any ordinary public table still lacks RLS.
--
-- Grant posture is intentionally unchanged here. Backend access uses the postgres table owner
-- (Prisma DIRECT_URL / DATABASE_URL). service_role is used only for Supabase Auth/Storage APIs.

-- ---------------------------------------------------------------------------
-- 1. Enable RLS on every ordinary public table discovered from the catalogue
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  enabled_count integer := 0;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT c.relrowsecurity
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      r.schema_name,
      r.table_name
    );
    enabled_count := enabled_count + 1;
    RAISE NOTICE 'RLS enabled on %.%', r.schema_name, r.table_name;
  END LOOP;

  RAISE NOTICE 'RLS catalogue enforcement: enabled RLS on % table(s)', enabled_count;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Verification assertion — migration MUST fail if RLS is still disabled
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  disabled_count integer;
  sample_names text;
BEGIN
  SELECT COUNT(*)::integer
  INTO disabled_count
  FROM pg_class c
  INNER JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity;

  IF disabled_count > 0 THEN
    SELECT string_agg(sample_name, ', ')
    INTO sample_names
    FROM (
      SELECT format('%I.%I', n.nspname, c.relname) AS sample_name
      FROM pg_class c
      INNER JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
      ORDER BY c.relname
      LIMIT 20
    ) samples;

    RAISE EXCEPTION
      'RLS catalogue enforcement failed: % public table(s) still have relrowsecurity=false. Sample: %',
      disabled_count,
      COALESCE(sample_names, '(none listed)');
  END IF;
END $$;
