# RLS Production Incident — Root Cause Analysis

**Date:** 2026-08-19  
**Project:** cresco-marketing-intelligence (Supabase `public` schema)

## Production evidence (ground truth)

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

**Observed on live Supabase:** `total_tables = 538`, `rls_enabled = 0`, `rls_disabled = 538`

Supabase Security Advisor: **538 × RLS Disabled in Public**

## Root cause

### Primary: RLS hardening migrations were never executed on production

The SQL in `20260811120000_supabase_rls_hardening` and `20260818120000_supabase_rls_reconciliation`
is structurally capable of enabling RLS. There are **no exception handlers** that swallow failures.
If those migrations had run against the current 538-table database as the `postgres` role, `pg_class.relrowsecurity`
would be `true` for every ordinary public table.

**Conclusion:** Production `_prisma_migrations` may list these migrations as applied in *some*
environment, but the **live Supabase PostgreSQL catalogue proves they did not execute** against the
production database that Security Advisor inspects.

Likely operational causes:

1. `prisma migrate deploy` was not run on production after RLS migrations merged
2. Migrations were marked applied via `prisma migrate resolve --applied` without SQL execution
3. Deploy targeted a different database URL than the Supabase project under audit
4. Database was restored from a pre-hardening backup after a migrate deploy

### Why previous migrations did not fail visibly

- Migrations are valid PostgreSQL and pass CI (superuser `postgres` on GitHub Actions)
- CI/database tests assert migration **source text** and post-migrate `pg_class` on the **CI database**
- No production `pg_class` verification was enforced after deploy
- Reconciliation migration (`20260818120000`) had **no terminal assertion** — it could be recorded as
  applied while production remained at `rls_disabled = 538` if never executed

### Why previous SQL was insufficient as proof

| Issue | Detail |
|-------|--------|
| No terminal verification | Migrations ended without `RAISE EXCEPTION` if RLS still disabled |
| `pg_tables` vs `pg_class` | Earlier migrations used `pg_tables`; reconciliation used `pg_class` — both work when executed, but neither verified outcome |
| Event triggers | `CREATE EVENT TRIGGER` in `20260811120000` only affects **future** `CREATE TABLE`; does not retroactively fix 538 existing tables unless section 1 runs |
| Trust in `_prisma_migrations` | Applied row ≠ executed SQL on production |

## Inventory discrepancy (634 models vs 538 production tables)

| Source | Count | Meaning |
|--------|------:|---------|
| `prisma/schema.prisma` models (repo HEAD) | 634 | Full application schema in Git |
| `public` ordinary tables (production `pg_class`) | 538 | Tables actually created by migrations deployed to production |
| Delta | 96 | Models/tables present in repo but **not yet deployed** to production |

The repository inventory (`docs/security/rls-inventory.json`) documents **Prisma models in Git**, not
the live production catalogue. Production is **behind** the repository schema by ~96 tables (worker
platform, unified publishing, domain events, appearance preferences, etc.).

**Security Advisor counts production tables (538), not repo models (634).**

## Corrective action

**Migration:** `20260819180000_supabase_rls_catalogue_enforcement`

- Discovers tables from `pg_class` where `relkind = 'r'` and `relrowsecurity = false`
- Runs `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for each
- **Raises exception** if any ordinary public table still has `relrowsecurity = false`
- **Does not change grants** (preserves backend/service_role posture audit separately)

## Backend access (unchanged)

| Runtime | DB identity | Access path |
|---------|-------------|-------------|
| Prisma app server | `postgres` (table owner) | `DATABASE_URL` / pooler |
| Prisma migrations | `postgres` | `DIRECT_URL` (session, not transaction pooler) |
| Workers / cron | `postgres` via same env | API routes → Prisma |
| Supabase Auth (browser) | JWT → `anon`/`authenticated` | `auth` schema only — **not** `public` app tables |
| Supabase Storage | `service_role` | `storage` schema only |
| Direct browser SQL | None | No `supabase.from()` on application tables |

## Status

**CODE FIX READY — PRODUCTION DEPLOYMENT REQUIRED**

Do not close this incident until production `pg_class` query returns `rls_disabled = 0`.
