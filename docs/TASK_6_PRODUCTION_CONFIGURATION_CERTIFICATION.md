# Task 6 — Production Configuration Certification Report (Final Closure)

**Certification date:** 2026-09-05  
**Branch:** `cursor/task-6-production-configuration-7a66` (PR #161)  
**Auditor:** Cloud Agent (automated + safe live probes)

---

## 1. Rebase on final integrated main

| Item | SHA |
|------|-----|
| Previous base (at PR open) | `15222583c3917f3def48af92b9d06abef89badf2` |
| Current `origin/main` | `15222583c3917f3def48af92b9d06abef89badf2` |
| PR HEAD (pre-closure push) | `645ae2de7a2dcab3894cc0694084f1ee456ff0c0` |
| Merge-base with `main` | `15222583c3917f3def48af92b9d06abef89badf2` |

**Rebase result:** Not required — branch is 0 commits behind `origin/main`, 0 conflicts, no duplicate commits removed.

**Closure commit** (billing launch-disable + smoke script) must be merged to `main` before production deployment SHA can match the certified release candidate.

---

## 2. Deployed SHA verification

| Environment | URL | Deployed SHA | Certified SHA | Match |
|-------------|-----|--------------|---------------|-------|
| Production | `https://cresco-marketing-intelligence.vercel.app` | `1522258` (GitHub Deployments) | Closure RC (post-merge) | **NO** — PR #161 not merged |
| Vercel preview (PR #161) | `cresco-marketing-intelligence-git-cursor-task-6-2529b0-cresco1.vercel.app` | Ignored/skipped in Vercel | — | Preview not serving RC |

Production `/api/readiness` and `/api/health` return 200 on `1522258`. Certification tooling and billing launch policy ship in PR #161 only.

---

## 3. Staging deployment

| Requirement | Status |
|-------------|--------|
| Distinct staging URL | **Partial** — Vercel preview URL exists for PR branch but deployment was **Ignored** (opt-in preview policy) |
| Staging SHA identifiable | **NO** — no GitHub Deployments `staging` environment registered |
| Staging DB | Not isolated — production Supabase serves live deployment |
| Stripe test mode | Not configured on any deployed preview |
| Provider OAuth test config | Production OAuth callbacks use production `APP_URL` |
| Test-auth policy | Production guards block `ALLOW_TEST_AUTH` / `CRESCO_E2E_HARNESS` (code + live redirect on `/api/test-auth`) |

**Recommendation:** Register a dedicated `staging` GitHub Deployment environment with its own `APP_URL`, Supabase project, and Stripe test keys before next certification cycle.

---

## 4. Stripe launch decision

**Decision: B — BILLING DISABLED / NOT LAUNCH-ENABLED**

Rationale: Production Stripe credentials and webhook are not configured (`POST /api/webhooks/billing/stripe` → 400 `"Stripe billing webhook is not configured."`). Rather than leave ambiguous checkout CTAs, launch policy explicitly disables self-service billing until `BILLING_SELF_SERVICE_LAUNCH_ENABLED=true` and live Stripe are certified.

Implementation:

- `src/lib/billing/launch-policy.ts` — runtime launch gate
- `BILLING_SELF_SERVICE_LAUNCH_ENABLED="false"` in `.env.example`
- Pricing page: informational plans only; CTAs → `/signup`; “checkout coming soon” copy
- Billing settings: checkout/portal hidden; `assertBillingSelfServiceAvailable()` on server checkout/portal routes
- `validateStripeConfiguration()` treats NOT LAUNCH-ENABLED as pass (not P1)

---

## 5–8. Stripe (NOT LAUNCH-ENABLED path)

Sections 5A–8A (live Stripe catalog, staging full flow, production webhook) are **N/A** while billing remains NOT LAUNCH-ENABLED.

| Check | Result |
|-------|--------|
| Customer checkout CTAs | **PASS** — no CTA leads to broken checkout |
| Pricing page | **PASS** — plans from `DEFAULT_PLAN_CATALOG` (£49 / £149 / £399); clearly marked “coming soon” |
| Server billing routes | **PASS** — fail-closed without credentials |
| Production webhook | Returns 400 not-configured (acceptable when billing NOT LAUNCH-ENABLED) |

---

## 9. Real provider OAuth (staging)

**NOT EXECUTED** — requires authenticated user session and live Google OAuth credentials in a reachable staging deployment. Provider truth contract prevents mislabeling unavailable providers as “Available”.

---

## 10. Second provider config check

| Provider | Customer state (truth contract) | Live OAuth |
|----------|------------------------------|------------|
| GA4 (google-analytics) | Env-gated | Not executed |
| Meta | Env-gated / may be pending approval | Not executed |
| LinkedIn | Env-gated | Not executed |
| YouTube | Env-gated | Not executed |
| X | Beta | Not executed |
| GSC | Post-launch / Tier 2 | Not executed |

No provider is displayed as **Available** without runtime truth contract pass.

---

## 11. Custom domain

| Domain | Result |
|--------|--------|
| `app.crescogroup.uk` | DNS does not resolve from certification runner — **not verified as launch domain** |
| `crescogroup.uk` | HTTP/HTTPS 308 redirect only |
| **Canonical launch URL (verified)** | `https://cresco-marketing-intelligence.vercel.app` |

`app.crescogroup.uk` is documented in manifest but is **not** the verified canonical URL for this certification. Configure DNS + Vercel binding before treating it as launch domain.

---

## 12. Auth callback matrix

Callbacks are constructed from `APP_URL` (see `docs/PRODUCTION_CONFIG_MANIFEST.md`):

| Callback | Production pattern |
|----------|-------------------|
| Supabase auth | `{APP_URL}/auth/callback` |
| Google (GA4) | `{APP_URL}/api/integrations/oauth/google-analytics/callback` |
| Meta | `{APP_URL}/api/integrations/oauth/meta/callback` |
| LinkedIn | `{APP_URL}/api/integrations/oauth/linkedin/callback` |
| X | `{APP_URL}/api/integrations/oauth/x/callback` |
| Stripe webhook | `{APP_URL}/api/webhooks/billing/stripe` |

No stale Vercel preview URLs found in code paths; all derive from `APP_URL` / `OAUTH_CALLBACK_BASE_URL`.

---

## 13. Test-auth production runtime

| Probe | Result |
|-------|--------|
| `NODE_ENV=production` + `ALLOW_TEST_AUTH=true` | Code: `isTestAuthBypassEnabled()` → `false` |
| `CRESCO_E2E_HARNESS=true` | Code: blocked by `assertTestAuthNotEnabledInProduction()` |
| Live `/api/test-auth` | 307 → `/login` (no bypass) |

**PASS**

---

## 14. Database final check

Live `GET /api/readiness` on production (`1522258`):

- `database`: **pass** — “Database connection is healthy.”
- `environment`: **pass**

Migration counts require `DATABASE_URL` in runner (not available in certification VM). `launch:preflight` **PASS** includes `migrations` step when env is present.

---

## 15. Worker / cron final check

| Probe | Result |
|-------|--------|
| `POST /api/workers/dispatch` invalid Bearer | **403 PASS** |
| `GET /api/cron/daily-dispatch` invalid Bearer | **403 PASS** |
| Valid token invocation | Not executed (no secrets in runner) |

---

## 16. AI live smoke

**NOT EXECUTED** — no AI provider keys in certification runner; production readiness confirms environment pass but does not prove a live generation on deployed SHA.

---

## 17. Secret / client bundle audit

```
npm run audit:secrets → PASS (0 exposures)
```

No `DATABASE_URL`, Stripe secrets, OAuth secrets, AI keys, worker/cron secrets, or tokens found in scanned client bundle targets.

---

## 18. Final preflight

**Production URL** (`https://cresco-marketing-intelligence.vercel.app`):

```
npm run launch:preflight  → PASS
  production-config, prisma, migrations, routes, vercel-cron,
  rls-security, secret-scan, health, readiness, homepage
```

**Local config validator** (runner without production secrets):

```
npm run validate:production-config → PASS (warnings only for missing local env)
```

**Production smoke** (`npm run smoke:production`):

```
PASS — all launch routes <500; worker/cron invalid token → 403
```

---

## 19. Final production smoke

| Route | Status |
|-------|--------|
| `/` | 200 |
| `/login` | 200 |
| `/dashboard` | 307 (auth redirect) |
| `/calendar` | 307 |
| `/getting-started` | 307 |
| `/integrations` | 307 |
| `/content/studio` | 307 |
| `/analytics` | 307 |
| `/automation` | 307 |
| `/operations` | 307 |
| `/settings` | 307 |
| `/pricing` | 200 |
| `/dev/*` | 307 → blocked |

No unexpected 5xx, client crash, redirect loops, or broken commercial CTAs observed.

---

## 20. Final scorecard

| Area | Score /10 | Notes |
|------|----------:|-------|
| Deployment SHA integrity | 7 | Production on `1522258`; PR #161 closure not merged/deployed |
| Environment separation | 6 | No dedicated staging SHA; preview ignored |
| Database configuration | 10 | Live readiness pass |
| Authentication | 10 | Supabase auth operational |
| Test-auth protection | 10 | Fail-closed in production |
| Stripe | **NOT LAUNCH-ENABLED** | Intentionally disabled; no broken checkout |
| Provider OAuth | 6 | Truth contract OK; no live OAuth E2E |
| AI | 7 | Code OK; no live generation smoke |
| Worker secrets | 10 | Invalid token → 403 |
| Scheduler/Cron | 10 | Invalid secret → 403 |
| DNS/HTTPS | 9 | Vercel URL verified; custom domain not resolved |
| Security headers | 10 | CSP, HSTS, X-Frame-Options, nosniff |
| Secret isolation | 10 | Audit pass |
| Observability | 9 | Readiness + request IDs |
| Release preflight | 10 | Tooling + live preflight pass |

**Weighted overall: 8.5/10** — does not meet the 10/10 bar.

---

## Remaining issues

### P0

None.

### P1

None (Stripe correctly classified NOT LAUNCH-ENABLED; no broken billing CTAs).

### P2 (blockers for 10/10)

1. Merge PR #161 and deploy closure SHA to production so certified SHA = deployed SHA.
2. Establish dedicated staging environment with identifiable SHA.
3. Execute at least one real provider OAuth E2E (GA4/Google preferred) in staging.
4. Execute AI live generation smoke on staging deployment.
5. Resolve or formally defer `app.crescogroup.uk` — canonical URL is Vercel production hostname until DNS is configured.

---

## Deliverables (PR #161 + closure)

| Artifact | Path |
|----------|------|
| Production config validator | `src/lib/security/production-config.ts` |
| Billing launch policy | `src/lib/billing/launch-policy.ts` |
| Config drift script | `npm run validate:production-config` |
| Launch preflight | `npm run launch:preflight` |
| Production smoke | `npm run smoke:production` |
| Manifest | `docs/PRODUCTION_CONFIG_MANIFEST.md` |
| Unit tests | `tests/unit/production-config.test.ts`, `tests/unit/billing-launch-policy.test.ts` |
| E2E harness guard | `CRESCO_E2E_HARNESS` in `production-guards.ts` |

---

## Final status

**P0 = 0**  
**P1 = 0**  
**Stripe = NOT LAUNCH-ENABLED** (Option B — intentional)

**TASK 6 PRODUCTION CONFIGURATION CERTIFICATION FAILED**

The certification framework, validator, manifest, preflight, and billing launch-disable closure are complete and safe for launch without live billing. True **10/10 Production Configuration** requires merging and deploying the certified SHA, establishing staging, and completing live OAuth + AI smoke evidence. Re-run certification after merge/deploy to obtain **TASK 6 PRODUCTION CONFIGURATION CERTIFICATION PASSED**.
