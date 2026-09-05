# Task 3 — Database / RLS / Data Integrity Certification

This document records the Task 3 certification baseline for Cresco Marketing Intelligence.
It contains **safe identifiers only** — no connection strings, passwords, service-role keys, or customer row payloads.

## 1. Database baseline

| Field | Value |
|---|---|
| Latest main SHA | `1522258` (includes Task 10 merge; Tasks 1–2 security fixes integrated on main) |
| Audited SHA | Set at certification commit on branch `cursor/task-3-database-certification-6bdf` |
| Staging DB environment | Supabase staging project (direct connection via `ANALYTICS_TEST_DATABASE_URL` in CI/staging workflows only) |
| Production DB environment | Supabase production project (migrate via `production-database-migrate.yml` using `PRODUCTION_DIRECT_URL` secret) |
| PostgreSQL version | 16 (CI service image; Supabase-managed in staging/production) |
| Supabase project/environment | Staging + Production (project refs configured in Vercel/Supabase — not printed here) |
| Prisma version | 6.19.0 |
| Total Prisma migrations | 89 |
| Last repository migration | `20260825193000_task_6_1_scheduler_heartbeat` |
| Pending migrations | Verified by `scripts/verify-production-migration.mjs` / `npm run audit:database-baseline` against target DB |
| Failed migrations | Must be `0` at certification time |
| RLS mode | Enabled on all `public` tables; API role grants revoked |
| Application database role | `postgres` (Prisma owner role; bypasses RLS as table owner) |
| PostgREST role behavior | `anon` / `authenticated` / `service_role` denied on `public` application tables |

## 2. Environment guards

Destructive commands are guarded by `scripts/guard-destructive-database-command.mjs` + `scripts/lib/database-environment-guard.mjs`:

- Blocks `db:migrate`, `db:push`, and seed against production-like URLs unless `ALLOW_PRODUCTION_DATABASE=confirm`
- Blocks test runs (`NODE_ENV=test`) from targeting production-like URLs
- Allows read-only `audit:*` commands on any target
- Allows controlled `db:migrate:deploy` only with `--allow-production` in production deploy workflow

## 3. Certification tooling

| Command | Purpose |
|---|---|
| `npm run audit:database-baseline` | Safe baseline metadata (SHA, migration counts, target classification) |
| `npm run audit:data-integrity` | Read-only orphan/duplicate/integrity aggregate audit |
| `npm run validate:rls-security` | Static RLS hardening migration guard (CI) |
| `npm run verify:rls-staging` | Live staging Supabase RLS verification |
| `npm run test:database` | Real PostgreSQL tenant isolation + integrity + RLS tests |

## 4. RLS inventory

Machine-readable inventory: `docs/SUPABASE_RLS_INVENTORY.json`  
Human summary: `docs/SUPABASE_RLS_SECURITY.md`

All application tables are classified. Tenant-owned tables use application-layer `organisationId` scoping for Prisma; PostgREST/API roles are deny-by-default on `public`.

## 5. Test matrix (Task 3)

| Check | Mechanism | Status |
|---|---|---|
| Clean migration from zero | CI `npx prisma migrate deploy` on empty Postgres 16 | PASS in CI |
| Existing DB migration | `verify-production-migration.mjs` / staging deploy workflow | PASS when pending=0 |
| Schema drift | `validate:migrations` + `prisma validate` | PASS |
| Prisma validate / generate | CI quality job | PASS |
| RLS classification | `validate:rls-security` + `rls-security.test.ts` | PASS |
| Live Tenant A/B | `tenant-isolation-certification.test.ts` + existing cross-tenant DB suites | PASS in CI |
| PostgREST deny-by-default | `rls-security.test.ts` + `verify-rls-staging.mjs` | PASS |
| Data integrity audit | `audit-data-integrity.mjs` + `data-integrity-audit.test.ts` | PASS on clean DB |
| Usage reservation concurrency | `usage-reservation-concurrency.test.ts` | PASS in CI |
| Provider integrity | `provider-cross-tenant.test.ts` | PASS in CI |
| Database CI gate | `main-branch.yml` database-tests required; PR runs on app/prisma changes | PASS |

## 6. Production read-only audit

When authorized, run on production:

```bash
npm run audit:database-baseline
npm run audit:data-integrity
```

These commands emit **aggregate counts only**. Do not run destructive Prisma commands against production outside the controlled migrate workflow.

## 7. Backup / restore

See `docs/V1_BACKUP_RECOVERY.md` and `docs/BACKUP_RECOVERY.md`.

- Backup frequency/retention: Supabase project settings (operational)
- Restore procedure: documented; **last successful restore test must be recorded operationally before claiming 10/10 Backup/Recovery in production**

## 8. Remediation policy

Findings from `audit:data-integrity` are **report-only**. No automatic destructive cleanup. Classify each category as:

- repair automatically (code/migration)
- controlled migration/script
- manual review
- retain intentionally

## 9. Certification status template

Fill at release gate after CI green + staging/production read-only audits:

```
P0 = 0
P1 = 0
P2 = documented only

Database Architecture /10
Tenant Isolation /10
RLS /10
Migration Safety /10
Data Integrity /10
Backup/Recovery /10 (requires successful restore test for full 10/10)

Final database score /10
TASK 3 DATABASE CERTIFICATION PASSED | FAILED
```
