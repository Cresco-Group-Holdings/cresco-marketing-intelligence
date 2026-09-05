# Task 3 — Database Certification Closure Report (Final)

**Certification date:** 2026-09-05  
**PR:** [#158](https://github.com/Cresco-Group-Holdings/cresco-marketing-intelligence/pull/158)  
**Branch:** `cursor/task-3-database-certification-6bdf`  
**Final certification SHA:** `0646747`

---

## 1. Merge gate (PR #158)

| Check | Status |
|-------|--------|
| Remote lint | **PASS** |
| Typecheck | **PASS** |
| Unit tests | **PASS** (PR CI) |
| Database tests | **PASS** (PR CI — Postgres 16 service) |
| `validate:migrations` (89 migrations) | **PASS** |
| `validate:rls-security` | **PASS** |
| Production build | **PASS** (when `ready-to-merge` / non-draft) |

PR may merge as certification **infrastructure** even though operational certification remains **FAILED** until live evidence is collected via protected workflow.

---

## 2. Production migration state — PRIORITY

| Field | Value |
|-------|-------|
| Latest repository migration | `20260825193000_task_6_1_scheduler_heartbeat` |
| Last successful `production-database-migrate.yml` run | **2026-08-19** |
| Live `_prisma_migrations` query on production | **NOT EXECUTED** (no `PRODUCTION_AUDIT_DATABASE_URL` in runner) |

**Suspected schema lag:** migrations after 2026-08-19 (including `20260825193000_task_6_1_scheduler_heartbeat`) may be pending on production.

| Expected | Actual (live) |
|----------|---------------|
| pending = 0 | **NOT VERIFIED** — classify **P1** until production read-only audit confirms |
| failed = 0 | **NOT VERIFIED** |

**Remediation:** After merge, configure `PRODUCTION_AUDIT_DATABASE_URL` (read-only) in `production-audit` environment and run:

```bash
gh workflow run database-certification.yml \
  -f confirmation=CERTIFY_DATABASE \
  -f run_staging=true \
  -f run_production=true
```

If pending > 0, run `production-database-migrate.yml` with `MIGRATE_PRODUCTION` (migration owner credential in `production` environment only).

`/api/readiness` database pass on deployed app does **not** prove migration currency.

---

## 3. Credential separation

| Credential | Canonical env var | GitHub environment | Access |
|------------|-------------------|-------------------|--------|
| Staging certification | `STAGING_CERTIFICATION_DATABASE_URL` | `staging-certification` | Read-only recommended |
| Production audit | `PRODUCTION_AUDIT_DATABASE_URL` | `production-audit` | **Read-only required** |
| Restore validation | `RESTORE_VALIDATION_DATABASE_URL` | `restore-validation` | Isolated target |
| Production migration | `PRODUCTION_DIRECT_URL` | `production` | Migrate workflow only |

Normal PR CI does not receive these secrets.

---

## 4. GitHub environment protection

Workflow `.github/workflows/database-certification.yml` uses protected environments:

| Environment | Manual approval recommended | Jobs |
|-------------|----------------------------|------|
| `staging-certification` | Yes | Staging baseline, RLS, integrity |
| `production-audit` | Yes | Production migration state + read-only audits |
| `restore-validation` | Yes | Restore validation |

Configure environment protection rules and secrets in GitHub repository settings before running live certification.

---

## 5–7. Live staging baseline / RLS / Tenant A/B

**NOT EXECUTED** — `STAGING_CERTIFICATION_DATABASE_URL` not available in certification runner.

CI equivalent (Postgres 16 service) provides application-layer evidence:

- Baseline: pending=0, failed=0 after `migrate deploy`
- RLS: `rls-security.test.ts` + `verify-rls-staging.mjs` pattern (CI)
- Tenant A/B: `tenant-isolation-certification.test.ts`, `provider-cross-tenant.test.ts`

Live staging Tenant A/B on shared staging data requires dedicated test accounts (destructive truncate tests are CI-only).

---

## 8. Staging data-integrity audit

**NOT CERTIFIED** (live staging)

CI clean-DB audit: **PASS** (`data-integrity-audit.test.ts`)

---

## 9–10. Production read-only audit

**NOT EXECUTED** — `PRODUCTION_AUDIT_DATABASE_URL` not configured in runner.

Commands (read-only, aggregate counts only):

```bash
npm run audit:database-baseline
npm run audit:data-integrity
```

---

## 11. Backup configuration live verification

**NOT EXECUTED** — requires Supabase dashboard access (not available in runner).

Documented targets in `docs/V1_BACKUP_RECOVERY.md` — not live-verified.

---

## 12–15. Restore exercise / RPO / RTO

**NOT EXECUTED** — `RESTORE_VALIDATION_DATABASE_URL` not configured.

---

## 16. Certification workflow

`database-certification.yml` exists on PR branch (not yet on `main`). Workflow emits explicit phase matrix per target:

- `PASS` / `FAIL` / `NOT CERTIFIED` / `NOT REQUESTED`

Missing credentials → **NOT CERTIFIED** (never silent green).

---

## 17. Phase matrix (live evidence)

| Check | Result |
|-------|--------|
| Production migrations current | **NOT CERTIFIED** (suspected P1 lag since 2026-08-19) |
| Staging schema drift | **NOT CERTIFIED** |
| Anonymous RLS | **PASS** (CI) / **NOT CERTIFIED** (live staging) |
| Authenticated RLS | **PASS** (CI) / **NOT CERTIFIED** (live staging) |
| Tenant A → B read | **PASS** (CI) / **NOT CERTIFIED** (live staging) |
| Tenant A → B write | **PASS** (CI) / **NOT CERTIFIED** (live staging) |
| Staging integrity | **NOT CERTIFIED** |
| Production integrity | **NOT CERTIFIED** |
| Backup live verified | **NOT CERTIFIED** |
| Restore successful | **NOT CERTIFIED** |
| Restored integrity | **NOT CERTIFIED** |
| Recovery app smoke | **NOT CERTIFIED** |
| RPO target | **NOT MEASURED** |
| RTO target | **NOT MEASURED** |

---

## 18. Issue counts

| P0 | P1 | P2 |
|----|----|-----|
| 0 | 5 | 2 |

**P1:**

1. Production migration state not verified live — suspected pending migrations since 2026-08-19
2. Staging live RLS not executed
3. Staging live Tenant A/B not executed
4. Production read-only integrity audit not executed
5. Backup configuration not live-verified

**P2:**

1. Restore exercise not performed
2. RPO/RTO not measured

---

## 19. Final score

| Area | Score /10 |
|------|----------:|
| Database Architecture | 9 |
| Tenant Isolation | 8 (CI PASS; live staging NOT CERTIFIED) |
| RLS | 8 (CI PASS; live staging NOT CERTIFIED) |
| Migration Safety | 6 (suspected production lag) |
| Data Integrity | 7 (CI PASS; production NOT CERTIFIED) |
| Backup & Recovery | 4 (not live-verified) |

**Overall: 7/10** — does not meet 10/10 bar.

---

## 20. Final status

**TASK 3 DATABASE CERTIFICATION FAILED**

Infrastructure is merge-ready. Collect live evidence by:

1. Merge PR #158
2. Configure protected GitHub environments with canonical secrets
3. Run `database-certification.yml` with `CERTIFY_DATABASE`
4. If production pending migrations > 0, run `production-database-migrate.yml`
5. Complete restore exercise when `RESTORE_VALIDATION_DATABASE_URL` is available
