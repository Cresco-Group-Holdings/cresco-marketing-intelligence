# RLS Grants Audit

## Audit queries

Run against staging/production after migration deploy:

```sql
-- Tables: grants to API-facing roles
SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- RLS status for all public tables
SELECT
  n.nspname AS schema,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- Function execute grants to PUBLIC / API roles
SELECT
  n.nspname,
  p.proname,
  acl.grantee::regrole::text AS grantee,
  acl.privilege_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', n.oid))) acl
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND (
    acl.grantee = 0
    OR acl.grantee::regrole::text IN ('anon', 'authenticated', 'service_role')
  )
ORDER BY p.proname, grantee;
```

## Expected posture (after hardening + reconciliation)

| Grantee | `public` tables | `public` sequences | `public` functions |
|---------|-----------------|--------------------|--------------------|
| `PUBLIC` | none | none | none (EXECUTE revoked) |
| `anon` | none | none | none |
| `authenticated` | none | none | none |
| `service_role` | none | none | none |
| `postgres` | owner (ALL) | owner | owner on created functions |

## Unsafe grants removed

The hardening migrations (`20260811120000_supabase_rls_hardening`,
`20260818120000_supabase_rls_reconciliation`) remove:

- `SELECT`, `INSERT`, `UPDATE`, `DELETE` on all `public` tables for API roles
- Sequence `USAGE` for API roles
- `EXECUTE` on all `public` functions for `PUBLIC` and API roles

`GRANT USAGE ON SCHEMA public` is retained for PostgREST schema introspection when API roles exist.

## Prisma compatibility

`postgres` remains table owner and bypasses RLS. No grants are revoked from `postgres`.

## Verification script

```bash
ANALYTICS_TEST_DATABASE_URL="postgresql://..." node scripts/verify-rls-staging.mjs
```

Optional: `RLS_VERIFY_RUN_MIGRATE=1` to run `prisma migrate deploy` before checks.
