# Supabase Public Schema RLS — Security Audit Report

**Date:** 2026-08-18  
**Project:** cresco-marketing-intelligence (production)  
**Status:** Remediation ready for staging deploy — **do not merge/deploy to production without staging verification**

---

## 1. Executive summary

| Metric | Before (production) | After (post-migration deploy) |
|--------|---------------------|-------------------------------|
| Supabase Security Advisor errors | **538** (RLS Disabled in Public) | **Expected: 0** RLS errors |
| Public tables | ~538–633 | 633+ (all RLS enabled) |
| Tables with RLS disabled | ~538 | **0** |
| Tables accessible to `anon` | Yes (default Supabase grants) | **0** |
| Tables accessible to `authenticated` | Yes (default grants) | **0** |
| Tables accessible to `service_role` on `public` | Yes (default grants) | **0** (grants revoked; Auth/Storage unaffected) |
| Intentionally public-read tables | 0 | 0 |
| Permissive RLS policies (`USING (true)`) | 0 | 0 |

**Root cause:** All Prisma application tables live in `public` with no RLS. Supabase auto-grants `anon`/`authenticated`/`service_role` access. The application never uses Supabase Data API (`supabase.from()` is absent), but PostgREST exposure creates a real attack surface.

**Remediation:** Repository-controlled SQL migrations (Option C — default deny):

1. `20260811120000_supabase_rls_hardening` — initial hardening + event triggers
2. `20260818210000_supabase_rls_hardening_reinforcement` — idempotent re-apply + PUBLIC grant revocation

---

## 2. Exposure verification methodology

Effective privileges were verified (not inferred from advisor warnings):

| Check | Tool |
|-------|------|
| RLS enabled per table | `pg_class.relrowsecurity` |
| RLS forced | `pg_class.relforcerowsecurity` (intentionally **false** — Prisma `postgres` owner bypass preserved) |
| Policies | `pg_policy` count (expected **0** — no permissive policies) |
| `anon`/`authenticated`/`service_role` grants | `has_table_privilege(role, table, privilege)` |
| `PUBLIC` grants | `aclexplode(relacl)` grantee = 0 |
| Backend access | Prisma queries as `postgres` (table owner) |
| Live audit script | `npm run audit:rls-exposure` |

**Unauthenticated access (production before fix):** `anon` could SELECT/INSERT/UPDATE/DELETE on all `public` tables where default Supabase grants exist (all application tables).

**After fix:** `has_table_privilege` returns `false` for all CRUD operations on all tested tables for `anon`, `authenticated`, and `service_role`.

---

## 3. Table classification (every table explicit)

Inventory: `docs/SUPABASE_RLS_INVENTORY.json` (635 entries including `_prisma_migrations`)

| Security class | Meaning | Count | Data API |
|----------------|---------|-------|----------|
| **A** | Backend/service-role only (Prisma) | 634 | No |
| **B** | Authenticated client access required | **0** | — |
| **C** | Intentionally public read | **0** | — |
| **D** | Internal/system/migration | **1** (`_prisma_migrations`) | No |

### Special tables

| Table area | Classification | RLS | Client grants | Access path |
|------------|----------------|-----|---------------|-------------|
| `_prisma_migrations` | D | Enabled | Revoked | Prisma `DIRECT_URL` only |
| Credentials/tokens (`SocialCredential`, `ProviderConnection`) | A | Enabled | Revoked | Prisma server only |
| OAuth/provider connections | A | Enabled | Revoked | Prisma server only |
| Publishing jobs (`PublishingJob`, `PublishingAttempt`) | A | Enabled | Revoked | Prisma server only |
| Social inbox/webhook data | A | Enabled | Revoked | Prisma server only |
| Marketing analytics | A | Enabled | Revoked | Prisma server only |
| Organisations/users/memberships | A | Enabled | Revoked | Prisma + API middleware |
| Audit/security data | A | Enabled | Revoked | Prisma server only |
| Billing | A | Enabled | Revoked | Prisma server only |
| Integrations | A | Enabled | Revoked | Prisma server only |

---

## 4. Tenant isolation

### Database layer (PostgREST / Supabase client)

| Test | Result |
|------|--------|
| Anonymous SELECT denied | **PASS** (no table privileges) |
| Anonymous INSERT/UPDATE/DELETE denied | **PASS** |
| Authenticated cross-tenant SELECT denied | **PASS** (no table privileges) |
| Authenticated cross-tenant INSERT denied | **PASS** |
| Authenticated cross-tenant UPDATE denied | **PASS** |
| Authenticated cross-tenant DELETE denied | **PASS** |
| `service_role` public table access | **PASS** (grants revoked) |
| Backend (`postgres`) queries work | **PASS** |
| `_prisma_migrations` not client-accessible | **PASS** |

### Application layer (Prisma — mandatory)

Cross-tenant isolation for `organisationId`/`brandId` is enforced in services and API routes. Existing tests cover this (`tests/unit/v1-tenant-isolation.test.ts`, integration cross-tenant suites). **RLS does not replace application-layer tenant guards for Prisma connections** (table owner bypasses RLS).

---

## 5. Migration files

| Migration | Purpose |
|-----------|---------|
| `prisma/migrations/20260811120000_supabase_rls_hardening/migration.sql` | Enable RLS, revoke API roles, event triggers, function hardening |
| `prisma/migrations/20260818210000_supabase_rls_hardening_reinforcement/migration.sql` | Idempotent re-apply, revoke PUBLIC grants, update event trigger |

---

## 6. Automated tests

| Suite | Path |
|-------|------|
| Migration SQL guards | `tests/unit/rls-security.test.ts` |
| Classification inventory | `tests/unit/supabase-rls-classification.test.ts` |
| Live database RLS | `tests/database/rls-security.test.ts` (43 tests) |
| CI validator | `npm run validate:rls-security` |
| Live audit | `npm run audit:rls-exposure` |
| Staging verification | `npm run verify:rls-staging` |

---

## 7. Validation results (local disposable DB)

| Command | Result |
|---------|--------|
| `npm run validate:migrations` | PASS (87 migrations) |
| `npm run validate:rls-security` | PASS |
| `npm run test:unit` | PASS (1718 tests) |
| `npm run test:integration` | PASS (441 tests) |
| `npm run test:database -- tests/database/rls-security.test.ts` | PASS (43 tests) |
| `npm run audit:rls-exposure` | PASS — DEFAULT-DENY ENFORCED |
| `npm run lint` | PASS (0 errors) |
| `npm run build:ci` | PASS |

---

## 8. Remaining warnings / manual steps

| Item | Justification |
|------|---------------|
| Remove `public` from Supabase Dashboard "Exposed schemas" | Defense-in-depth after staging verification; Auth/Storage unaffected |
| Application-layer tenant isolation | Required regardless of RLS — Prisma bypasses RLS as table owner |
| `service_role` has `rolbypassrls=true` | Acceptable — grants revoked on `public` tables; used only for Auth admin + Storage |

---

## 9. Rollback procedure

**Do not rollback in production without incident review.**

If rollback is required:

1. Restore database from pre-migration snapshot (preferred).
2. Or manually (staging only): `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` is **blocked** by CI guards — do not disable RLS.
3. Re-granting `anon`/`authenticated` privileges would re-expose tenant data — **not recommended**.

Forward fix: re-run `prisma migrate deploy` to re-apply idempotent hardening migrations.

---

## 10. Staging deployment checklist (mandatory before production)

- [ ] `prisma migrate deploy` on staging Supabase
- [ ] `npm run verify:rls-staging` against staging `ANALYTICS_TEST_DATABASE_URL`
- [ ] `npm run audit:rls-exposure` — verdict DEFAULT-DENY ENFORCED
- [ ] Auth sign-in/sign-out works
- [ ] Storage upload/signed URL works
- [ ] Application API tenant operations work
- [ ] Re-run Supabase Security Advisor — expect 0 RLS errors
- [ ] Optional: remove `public` from Exposed schemas in Dashboard

---

## 11. Final verdict

| Environment | Verdict |
|-------------|---------|
| **Repository** | **PRODUCTION SECURITY READY** (migrations + tests merged) |
| **Production database** | **BLOCKED** until `prisma migrate deploy` + staging verification complete |

**Supabase Advisor errors before:** 538  
**Supabase Advisor errors after (expected post-deploy):** 0 RLS Disabled in Public
