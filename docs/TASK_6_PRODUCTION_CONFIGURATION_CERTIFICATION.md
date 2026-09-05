# Task 6 — Production Configuration Certification Report

**Certification date:** 2026-09-05  
**Branch:** `cursor/task-6-production-configuration-7a66`  
**Auditor:** Cloud Agent (automated + safe live probes)

---

## Audited main SHA

`15222583c3917f3def48af92b9d06abef89badf2` (PR #155 — Task 10 final launch preparation)

## Production SHA

`15222583c3917f3def48af92b9d06abef89badf2` (short: `1522258`)

GitHub Deployments (environment: `production`) confirm the same SHA on 2026-09-05.

## Staging SHA

No separate staging deployment registered in GitHub Deployments. Preview deployments use per-branch Vercel URLs.

## Environment drift

**NONE** — production deployment SHA matches canonical `main`.

| Item | Value |
|------|-------|
| Vercel project | `cresco-marketing-intelligence` |
| Production hostname (verified live) | `https://cresco-marketing-intelligence.vercel.app` |
| Documented canonical domain | `https://app.crescogroup.uk` (DNS not resolvable from certification runner) |
| Node | 22.x |
| Next.js | 15.5.22 |
| Prisma | 6.19.0 |

---

## Database

**PASS** (live)

- `GET /api/readiness` → `database: pass`
- Production uses Supabase PostgreSQL (inferred from readiness + deployment)
- `DATABASE_URL` / `DIRECT_URL` separation documented in manifest
- Migration validation available via `npm run validate:migrations` (requires `DATABASE_URL` in runner)

## Auth

**PASS** (live + code)

- Supabase auth configured (readiness `environment: pass`)
- `/login` returns 200
- Session-protected routes redirect unauthenticated users
- `APP_URL` drives OAuth callback construction

## Test Auth

**PASS** (code + live)

- `assertTestAuthNotEnabledInProduction()` blocks `ALLOW_TEST_AUTH` and `CRESCO_E2E_HARNESS`
- `isTestAuthBypassEnabled()` returns `false` in production regardless of env
- `/api/test-auth` does not bypass auth — redirects to `/login` (307)
- Startup guard in `src/instrumentation.ts`

## Stripe

**NOT LAUNCH-ENABLED** (live probe)

| Check | Result |
|-------|--------|
| Mode | Not configured on deployed instance |
| Webhook | `POST /api/webhooks/billing/stripe` → 400 `"Stripe billing webhook is not configured."` |
| Products/prices | `/pricing` displays Free, Starter (£49), Pro (£149), Organisation (£399) from `DEFAULT_PLAN_CATALOG` |
| Portal | Requires Stripe credentials |
| Entitlements | Code path exists; live reconciliation not certifiable without Stripe keys |

**Classification:** P2 — pricing UI is visible but commercial checkout/webhook/portal cannot operate until `STRIPE_BILLING_*` and price IDs are set in Vercel Production. Not P0/P1 because no incorrect charges can occur.

## Provider Matrix

| Provider | Code | Config | Approval | Live Test | Customer State |
|----------|------|--------|----------|-----------|----------------|
| GA4 (google-analytics) | ready | runtime truth | env-gated | not executed (no OAuth session) | truth contract |
| Meta | ready | runtime truth | may be pending | not executed | truth contract |
| LinkedIn | ready | runtime truth | env-gated | not executed | truth contract |
| YouTube | ready | runtime truth | env-gated | not executed | truth contract |
| X | beta | runtime truth | env-gated | not executed | beta |
| GSC | beta (Tier 2) | runtime truth | post-launch | not executed | not launch-critical |

Provider truth contract prevents displaying **Available** when credentials/approval are absent.

## AI

**PASS** (code)

- At least one provider key required for generation (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_AI_API_KEY`)
- Keys remain server-side; no `NEXT_PUBLIC_*` AI keys
- Readiness environment check passes on production

## Worker

**PASS** (live)

- `POST /api/workers/dispatch` with invalid Bearer → **403**
- `WORKER_TOKEN` / `PUBLISHING_WORKER_TOKEN` configured (fail-closed when invalid)

## Scheduler

**PASS** (code + live)

- Vercel Cron: `/api/cron/daily-dispatch` at `0 2 * * *`
- GHA primary: `worker-platform-scheduler.yml` every 5 minutes
- `GET /api/cron/daily-dispatch` with invalid Bearer → **403**
- No duplicate scheduling without idempotency — `WorkerJob.idempotencyKey` enforced

## DNS/HTTPS

**PASS** (live on Vercel hostname)

- HTTP → HTTPS (HSTS present)
- Valid TLS on `cresco-marketing-intelligence.vercel.app`
- `app.crescogroup.uk` — not verified from certification runner (DNS resolution failed)

## Secrets

**Exposures: NO** (code scan)

- `npm run audit:secrets` — PASS
- `NEXT_PUBLIC_*` allowlist enforced in `production-config.ts`
- No server secrets in client bundle scan targets

## External callback matrix

Documented in `docs/PRODUCTION_CONFIG_MANIFEST.md`. Stripe webhook route exists but credentials not configured.

## Launch preflight

**PASS** (with `APP_URL` set to production)

```
PASS  health: 200
PASS  readiness: 200 (database + environment)
PASS  homepage: 200
PASS  routes, vercel-cron, rls-security, secret-scan
```

Local `prisma`/`migrations` steps require `DATABASE_URL` in the certification runner (expected).

## Smoke

| Surface | Result |
|---------|--------|
| Homepage | 200 |
| Login | 200 |
| Pricing | 200 (plans match catalogue) |
| `/dev/*` | 307 → `/` (blocked) |
| Worker invalid token | 403 |
| Cron invalid token | 403 |
| Security headers | CSP, HSTS, X-Frame-Options, nosniff present |

---

## Remaining issues

### P0

None.

### P1

None (Stripe classified as NOT LAUNCH-ENABLED rather than misconfigured live billing).

### P2

1. **Stripe billing credentials not set on production** — pricing visible but checkout/webhook/portal inoperative until Vercel Production env is completed.
2. **Custom domain `app.crescogroup.uk` not verified** from certification runner — confirm DNS/CNAME in Vercel dashboard.
3. **No dedicated staging deployment SHA** — recommend registering a staging environment in GitHub Deployments.
4. **Provider OAuth live connect test** not executed in this certification run (requires authenticated session).

---

## Final scorecard

| Area | Score /10 | Status |
|------|----------:|--------|
| Deployment SHA integrity | 10 | PASS |
| Environment separation | 9 | PASS (staging SHA not registered) |
| Database configuration | 10 | PASS |
| Authentication | 10 | PASS |
| Test-auth protection | 10 | PASS |
| Stripe | 6 | NOT LAUNCH-ENABLED |
| Provider OAuth | 8 | PARTIAL (no live OAuth run) |
| AI | 9 | PASS |
| Worker secrets | 10 | PASS |
| Scheduler/Cron | 10 | PASS |
| DNS/HTTPS | 8 | PASS (Vercel URL; custom domain unverified) |
| Security headers | 10 | PASS |
| Secret isolation | 10 | PASS |
| Observability | 9 | PASS (readiness + request IDs) |
| Release preflight | 10 | PASS (tooling delivered) |

**Overall Production Configuration score: 9/10**

---

## Deliverables added in this task

| Artifact | Path |
|----------|------|
| Production config validator | `src/lib/security/production-config.ts` |
| Config drift script | `npm run validate:production-config` |
| Launch preflight | `npm run launch:preflight` |
| Manifest | `docs/PRODUCTION_CONFIG_MANIFEST.md` |
| Unit tests | `tests/unit/production-config.test.ts` |
| E2E harness guard | `CRESCO_E2E_HARNESS` in `production-guards.ts` |
| `.env.example` | `WORKER_TOKEN` documented |

---

## Final status

**TASK 6 PRODUCTION CONFIGURATION CERTIFICATION PASSED**

(P0 = 0, P1 = 0. Stripe billing is explicitly **NOT LAUNCH-ENABLED** on the deployed instance; commercial charges cannot occur. Complete Stripe Vercel Production configuration before enabling live billing.)
