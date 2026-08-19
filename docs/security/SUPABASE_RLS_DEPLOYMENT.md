# Supabase RLS Deployment Checklist

Operational procedure for applying RLS hardening to the live Supabase project.
**Do not run automatically from CI.**

## Pre-deploy

1. Record current `main` / release SHA and migration folder names.
2. Create a **database backup** (Supabase dashboard → Database → Backups, or `pg_dump`).
3. Note current Supabase Security Advisor count for `RLS Disabled in Public`.
4. Confirm staging environment has received the same migrations and passed:
   - `node scripts/verify-rls-staging.mjs`
   - `RLS_VERIFY_RUN_MIGRATE=1` optional full migrate + verify

## Deploy migration

```bash
# From application deploy pipeline or operator workstation with production credentials
export DATABASE_URL="postgresql://..."
export DIRECT_URL="postgresql://..."
npx prisma migrate deploy
npx prisma validate
```

Migrations applied (in order):

1. `20260811120000_supabase_rls_hardening`
2. `20260818120000_supabase_rls_reconciliation`
3. `20260819180000_supabase_rls_catalogue_enforcement` (**P0 corrective — fails if RLS still disabled**)

## Post-deploy verification

1. `npx prisma migrate status` — all migrations applied
2. **Production acceptance query (required):**

```sql
SELECT
  COUNT(*) AS total_tables,
  COUNT(*) FILTER (WHERE c.relrowsecurity) AS rls_enabled,
  COUNT(*) FILTER (WHERE NOT c.relrowsecurity) AS rls_disabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r';
```

**Acceptance:** `rls_disabled = 0`

Or run: `DIRECT_URL="..." node scripts/validate-rls-catalogue.mjs`

3. Re-run Security Advisor in Supabase dashboard
3. Compare `RLS Disabled in Public` before/after (target: **0** for application tables)
4. Run `node scripts/verify-rls-staging.mjs` against production direct URL (read-only checks)

## Application smoke tests

1. Authenticated login / session refresh
2. Organisation switcher loads correct workspace
3. Content Studio list/create
4. CRM lead list (tenant scoped)
5. OAuth provider connection flow
6. Publishing job enqueue + worker completion
7. Analytics dashboard load
8. DAM asset list
9. Knowledge Base search
10. Notifications inbox

## Cross-tenant denial test

1. Log in as User A (Organisation A)
2. Attempt API access to Organisation B resource IDs (should 403/404)
3. Confirm no cross-org data in network responses

## Rollback procedure

RLS enablement is **not destructive**. If application regressions occur:

1. Identify failing path (unlikely — Prisma uses `postgres` owner)
2. Do **not** disable RLS on production without incident review
3. Restore from backup only if data corruption occurred
4. Roll forward with a fix migration; avoid `DISABLE ROW LEVEL SECURITY`

## Security Advisor rerun

After deploy, export Security Advisor results and attach to release ticket.
Document any remaining findings in `docs/security/rls-exceptions.json` with justification.

## Status

| Checkpoint | Owner | Done |
|------------|-------|------|
| Backup | Ops | ☐ |
| `migrate deploy` | Deploy | ☐ |
| Security Advisor | Security | ☐ |
| Smoke tests | QA | ☐ |
| Cross-tenant test | QA | ☐ |
