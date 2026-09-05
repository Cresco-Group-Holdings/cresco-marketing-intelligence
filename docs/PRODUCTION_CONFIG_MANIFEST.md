# Production Configuration Manifest

Canonical inventory of production dependencies for Cresco Marketing Intelligence.  
**No secret values are recorded in this document.**

Last updated: Task 6 certification (`cursor/task-6-production-configuration-7a66`).

## Validation commands

| Command | Purpose |
|---------|---------|
| `npm run validate:production-config` | Shape/presence/cross-consistency checks (no secrets printed) |
| `npm run launch:preflight` | Aggregates validators + optional `APP_URL` HTTP smoke |
| `npm run audit:secrets` | Repository secret leak scan |

Implementation: `src/lib/security/production-config.ts`, `scripts/validate-production-config.mjs`, `scripts/launch-preflight.mjs`.

---

## Release baseline (certified 2026-09-05)

| Item | Value |
|------|-------|
| Canonical `main` SHA | `15222583c3917f3def48af92b9d06abef89badf2` |
| Production deployment SHA | `1522258` (GitHub Deployments — matches `main`) |
| Staging deployment SHA | Not separately registered in GitHub Deployments |
| Vercel project | `cresco-marketing-intelligence` |
| Production hostname (verified) | `https://cresco-marketing-intelligence.vercel.app` |
| Canonical product domain (documented) | `https://app.crescogroup.uk` |
| Node version | 22.x (Vercel runtime) |
| Next.js version | 15.5.22 |
| Prisma version | 6.19.0 |
| Database environment | Supabase PostgreSQL (production project) |
| Primary scheduler | GitHub Actions `worker-platform-scheduler.yml` (every 5 min) |
| Secondary scheduler | Vercel Cron `/api/cron/daily-dispatch` (02:00 UTC daily) |
| Stripe mode (production) | **NOT CONFIGURED** on deployed instance (webhook returns not configured) |
| Enabled AI provider | At least one of OpenAI / Anthropic / Google AI (readiness env check passes) |

**Deployment drift:** NONE — production SHA matches canonical `main`.

---

## Variable classification

Legend:

- **Required** — startup fails without it (Zod schema or production guard)
- **Optional** — feature-gated; disabled features must not block startup
- **Scope** — Development / Preview / Staging / Production
- **Secret** — server-only; never `NEXT_PUBLIC_*`
- **Verified** — confirmed in deployed environment or automated check

### AUTH

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All | Auth client, middleware | No | YES (readiness pass) | CODE |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | All | Auth client | No | YES | CODE |
| `SUPABASE_URL` | Optional | Server | SSR auth fallback | No | YES | CODE |
| `SUPABASE_ANON_KEY` | Optional | Server | SSR auth fallback | No | CODE | CODE |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server | Admin operations | Yes | YES | CODE |
| `APP_URL` | Yes | Per-env | OAuth callbacks, redirects | No | YES | CODE |
| `ALLOW_TEST_AUTH` | Forbidden in prod | Test only | Middleware bypass | No | YES (blocked) | N/A |
| `TEST_AUTH_USER_ID` | Test only | Test only | Test auth | No | YES (ignored in prod) | N/A |
| `CRESCO_E2E_HARNESS` | Forbidden in prod | Test only | E2E harness | No | YES (startup guard) | N/A |

### DATABASE

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `DATABASE_URL` | Yes | Per-env | Prisma runtime (pooler) | Yes | YES (readiness DB pass) | CODE |
| `DIRECT_URL` | Yes | Per-env | Prisma migrations | Yes | CODE | CODE |
| `ANALYTICS_TEST_DATABASE_URL` | Test only | CI/E2E | `test:database` | Yes | N/A (not prod) | N/A |

### STRIPE

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `STRIPE_BILLING_SECRET_KEY` | If billing enabled | Production | Checkout, portal | Yes | **NO** | CODE |
| `STRIPE_BILLING_WEBHOOK_SECRET` | If billing enabled | Production | `/api/webhooks/billing/stripe` | Yes | **NO** | CODE |
| `STRIPE_BILLING_PUBLISHABLE_KEY` | If billing enabled | Production | Client checkout | No | CODE | CODE |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional | Public | Client fallback | No | CODE | CODE |
| `STRIPE_PRICE_STARTER_MONTHLY` | If billing enabled | Production | Plan mapping | No | CODE | CODE |
| `STRIPE_PRICE_STARTER_ANNUAL` | If billing enabled | Production | Plan mapping | No | CODE | CODE |
| `STRIPE_PRICE_PRO_MONTHLY` | If billing enabled | Production | Plan mapping | No | CODE | CODE |
| `STRIPE_PRICE_PRO_ANNUAL` | If billing enabled | Production | Plan mapping | No | CODE | CODE |
| `STRIPE_PRICE_ORGANISATION_MONTHLY` | If billing enabled | Production | Plan mapping | No | CODE | CODE |
| `STRIPE_PRICE_ORGANISATION_ANNUAL` | If billing enabled | Production | Plan mapping | No | CODE | CODE |
| `ALLOW_BILLING_MOCK` | Forbidden in prod | Dev/Preview | Mock billing | No | YES (forbidden) | CODE |

### PROVIDERS

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `GOOGLE_CLIENT_ID` | Optional | Per-env | GA4, GSC, YouTube OAuth | No | CODE | CODE |
| `GOOGLE_CLIENT_SECRET` | Optional | Per-env | Google OAuth | Yes | CODE | CODE |
| `META_APP_ID` | Optional | Per-env | Meta OAuth | No | CODE | CODE |
| `META_APP_SECRET` | Optional | Per-env | Meta OAuth | Yes | CODE | CODE |
| `LINKEDIN_CLIENT_ID` | Optional | Per-env | LinkedIn OAuth | No | CODE | CODE |
| `LINKEDIN_CLIENT_SECRET` | Optional | Per-env | LinkedIn OAuth | Yes | CODE | CODE |
| `X_CLIENT_ID` | Optional | Per-env | X OAuth | No | CODE | CODE |
| `X_CLIENT_SECRET` | Optional | Per-env | X OAuth | Yes | CODE | CODE |
| `OAUTH_CALLBACK_BASE_URL` | Optional | Per-env | OAuth redirects | No | CODE | CODE |
| `OAUTH_STATE_SIGNING_KEY` | Optional | Per-env | OAuth state HMAC | Yes | CODE | CODE |
| `PROVIDER_*_EXTERNAL_APPROVED` | Per provider | Production | Provider truth contract | No | CODE | CODE |

### AI

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `OPENAI_API_KEY` | One of three | Server | AI generation | Yes | CODE (env pass) | CODE |
| `ANTHROPIC_API_KEY` | One of three | Server | AI generation | Yes | CODE | CODE |
| `GOOGLE_AI_API_KEY` | One of three | Server | AI generation | Yes | CODE | CODE |

### WORKERS

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `WORKER_TOKEN` | Yes (or alias) | Production | `/api/workers/*` | Yes | YES (403 invalid) | CODE |
| `PUBLISHING_WORKER_TOKEN` | Alias | Production | Worker auth fallback | Yes | YES | CODE |
| `SOCIAL_REPORTS_WORKER_SECRET` | Optional | Production | Social reports worker | Yes | CODE | CODE |

### CRON

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `CRON_SECRET` | Yes | Production | `/api/cron/daily-dispatch` | Yes | YES (403 invalid) | CODE |
| `CRON_SCHEDULER_ENABLED` | Optional | All | Scheduling gate | No | CODE | CODE |
| `CRON_ALLOW_PREVIEW` | Forbidden prod | Preview | Preview cron side effects | No | YES (forbidden) | CODE |
| `CRON_ALLOW_DEVELOPMENT` | Forbidden prod | Dev | Dev cron side effects | No | YES (forbidden) | CODE |

### APPLICATION

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `ENCRYPTION_KEY` | Yes | Per-env | Credential encryption | Yes | YES | CODE |
| `NEXT_PUBLIC_APP_URL` | Optional | Public | Email links fallback | No | CODE | CODE |
| `VERCEL_ENV` | Runtime | Vercel | Environment detection | No | YES | CODE |

### OBSERVABILITY

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `PRODUCTION_DIAGNOSTICS_TOKEN` | Optional | Production | Auth DB diagnostics | Yes | CODE | CODE |
| `PRODUCTION_AUTH_DATABASE_DIAGNOSTICS_ENABLED` | Optional | Production | Diagnostics gate | No | CODE | CODE |

### EMAIL / NOTIFICATIONS

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `RESEND_PROVIDER_ENABLED` | Optional | Server | Email delivery | No | CODE | CODE |
| `EMAIL_EMERGENCY_SHUTDOWN` | Optional | Server | Email kill switch | No | CODE | CODE |

### ANALYTICS

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `SOCIAL_ANALYTICS_SYNC_*` | Optional | Server | Social sync cadence | No | CODE | CODE |

### SECURITY

| Variable | Required | Scope | Consumed by | Secret | Prod verified | Staging verified |
|----------|----------|-------|-------------|--------|---------------|------------------|
| `ALLOW_OAUTH_MOCK` | Forbidden prod | Dev/Test | OAuth mock adapters | No | YES (forbidden) | CODE |
| `ALLOW_MOCK_SOCIAL_ADAPTERS` | Forbidden prod | Dev/Test | Mock social | No | YES (forbidden) | CODE |

---

## Scheduler source of truth

| Work type | Primary mechanism | Cadence |
|-----------|-------------------|---------|
| Worker job dispatch/process | GitHub Actions `worker-platform-scheduler.yml` | Every 5 minutes |
| Publishing due work | GHA scheduler (legacy pass) | Every 5 minutes |
| Automation schedules | GHA `/api/workers/automation-schedules` | Every 5 minutes |
| Daily fan-out (publishing, intelligence) | Vercel Cron `/api/cron/daily-dispatch` | 02:00 UTC daily |
| Social analytics sync | GHA `social-analytics-scheduler.yml` | Every 6 hours |

Idempotency is enforced at the `WorkerJob` layer regardless of duplicate scheduler invocation.

---

## Callback / webhook URL matrix

| Service | Staging URL | Production URL | Verified | HTTP | Status |
|---------|-------------|----------------|----------|------|--------|
| Supabase Auth | Preview `APP_URL/auth/callback` | `https://cresco-marketing-intelligence.vercel.app/auth/callback` | CODE | 200 login flow | CONFIGURED |
| Google OAuth | Preview callback | `{APP_URL}/api/integrations/oauth/google-analytics/callback` | CODE | — | CONFIGURED |
| Meta OAuth | Preview callback | `{APP_URL}/api/integrations/oauth/meta/callback` | CODE | — | CONFIGURED |
| LinkedIn OAuth | Preview callback | `{APP_URL}/api/integrations/oauth/linkedin/callback` | CODE | — | CONFIGURED |
| X OAuth | Preview callback | `{APP_URL}/api/integrations/oauth/x/callback` | CODE | — | CONFIGURED |
| Stripe billing webhook | Test mode endpoint | `https://cresco-marketing-intelligence.vercel.app/api/webhooks/billing/stripe` | YES | 400 not configured | **NOT CONFIGURED** |
| Stripe revenue webhook | Test mode | `/api/webhooks/stripe` | CODE | — | OPTIONAL |

---

## Feature availability matrix

| Feature | Code ready | Production configured | External approval | Customer available |
|---------|------------|----------------------|-------------------|-------------------|
| GA4 analytics | Yes | CODE | CODE | Truth contract |
| LinkedIn analytics | Yes | CODE | CODE | Truth contract |
| Meta | Yes | CODE | PENDING possible | Truth contract |
| X | Yes (beta) | CODE | CODE | Beta |
| Publishing | Yes | YES (worker auth) | N/A | Yes |
| Stripe billing | Yes | **NO** (credentials absent) | N/A | UI only (pricing page) |
| AI generation | Yes | YES (env pass) | N/A | Yes |
| Automations | Yes | YES (scheduler) | N/A | Yes |

Provider truth is resolved at runtime via `src/lib/providers/provider-truth-contract.ts`.

---

## Configuration ownership

| Dependency | Owner |
|------------|-------|
| Stripe | Platform / Finance |
| Google (GA4, GSC, YouTube) | Platform / Integrations |
| Meta | Platform / Integrations |
| LinkedIn | Platform / Integrations |
| X | Platform / Integrations |
| Supabase | Platform / Infrastructure |
| Vercel | Platform / Infrastructure |
| AI provider (OpenAI/Anthropic/Google) | Platform / AI |

---

## Rotation / recovery

Rotation does not require source-code changes for:

- Database credentials (`DATABASE_URL`, `DIRECT_URL`)
- Stripe secrets (`STRIPE_BILLING_*`)
- OAuth client secrets (provider env vars)
- AI API keys
- `WORKER_TOKEN`, `CRON_SECRET`, `ENCRYPTION_KEY`

Update Vercel environment variables and GitHub Actions secrets, then redeploy.

---

## Release order

1. `npm run launch:preflight` (with production `APP_URL` and env)
2. `npm run db:migrate:deploy` (using `DIRECT_URL`)
3. Deploy application (Vercel promote)
4. `GET /api/readiness` — all critical checks pass
5. Smoke: homepage, login, dashboard, integrations, billing UI
6. Post-deploy: `npm run validate:production-config` in production context
