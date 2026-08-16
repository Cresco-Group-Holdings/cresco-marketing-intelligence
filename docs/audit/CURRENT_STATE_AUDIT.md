# Current State Audit — Repository Baseline & Architecture

**Main SHA:** `8910740bab558d5639d256c86d9ee00d0b47535e`  
**Audit date:** 2026-08-16

---

## Phase 0 — Repository Baseline

| Metric | Value |
|--------|-------|
| Repository | Cresco-Group-Holdings/cresco-marketing-intelligence |
| Branch audited | `main` |
| HEAD SHA | `8910740bab558d5639d256c86d9ee00d0b47535e` |
| Node (CI) | 22.x (local: v22.14.0) |
| Next.js | 15.5.22 |
| React | 19.1.0 |
| Prisma | 6.19.0 |
| Database | PostgreSQL (Supabase in production; CI uses Postgres 16) |
| Package manager | npm |
| TypeScript source files | 1,901 (`src/**/*.ts(x)`) |
| Approximate LOC (src) | 183,089 |
| Prisma schema lines | 21,621 |
| Prisma models | 632 |
| Prisma enums | 489 |
| Migrations | 82 |
| API routes (`route.ts`) | 448 |
| App pages (`page.tsx`, excl. API) | 339 |
| Server services | 233 |
| Server provider modules | 15 files (7 dirs) |
| Lib provider modules | 21 files |
| Unit test files | 196 |
| Integration test files | 73 |
| Database test files | 6 |
| E2E test files | 9 |

### Test run results (audit execution)

| Suite | Files | Tests | Result |
|-------|-------|-------|--------|
| Unit | 196 | 1,548 | PASS |
| Integration | 73 | 434 | PASS |
| Database | 6 | 70 | PASS |
| E2E | 9 | not run in audit | — |

### Fresh database migration test

`npx prisma migrate deploy` on empty PostgreSQL database `cresco_audit_fresh`: **82/82 migrations applied successfully**.

---

## A / B / C Classification

### A. CURRENT MAIN (production truth)

Everything at SHA `8910740` — sole basis for scores and readiness.

### B. BUILT BUT NOT MERGED

109 remote `cursor/*` branches exist. Notable unmerged feature branches (by name; **not counted as production**):

| Branch pattern | Likely content |
|----------------|----------------|
| `cursor/stage-12-oauth-credentials-d3f8` | OAuth merge sync (may overlap main) |
| `cursor/stage-6-content-calendar-d3f8` | Calendar baseline test repair |
| `cursor/stage-17-security-enterprise-d3f8` | Security hardening |
| `cursor/supabase-rls-hardening-d3f8` | RLS (likely merged via main) |
| `cursor/*-e94c` | Legacy feature slices (50+ branches) |

`gh pr list --state open` returned empty at audit time (may reflect token scope). **Rule applied: only main counts.**

### C. PLANNED / NOT BUILT

- Real OAuth token exchange for major providers
- External calendar sync (Google/Outlook)
- Enterprise SSO
- Live sandbox E2E in CI
- Per-tenant Supabase RLS policies

---

## Phase 1 — Architecture Map

### Request flow (synchronous)

```
Browser (Next.js 15 App Router)
  → middleware.ts (Supabase session refresh only)
  → page.tsx / client components
  → fetch(/api/...) with organisationId query/header
  → withApiHandler / domain *-handler wrappers
  → hasPermission(organisationRole, permission)
  → runWithTenantContext (AsyncLocalStorage)
  → server/services/*.ts
  → Prisma → PostgreSQL
  → JSON response → UI refresh
```

### Provider gateway flow

```
API / Service
  → providerGateway / platform-registry / adapter-registry
  → resolvePlatformAdapter(providerKey)  [mocks: advertising, crm, social]
  → OR publication-execution-service
  → OR *-publishing-service → src/lib/social/*-adapter (real HTTP)
  → OR advertising-*-service → src/lib/*-ads/* (real HTTP)
  → External provider API
```

### Async / scheduled flow

```
Vercel Cron (daily 02:00 UTC)
  → /api/cron/daily-dispatch
  → dailyCronDispatchService (publishing enqueue pass)

GitHub Actions (every 6h)
  → POST /api/social-analytics-sync/schedule

Manual / scripted workers (require secrets)
  → /api/publishing-scheduler/process-due
  → /api/seo-crawl/process-due
  → /api/digital-assets/process-due
  → /api/notifications/digest/process-due
  → /api/publishing-jobs/[jobId]/process
```

### Architecture inventory

| Layer | Implementation | Notes |
|-------|----------------|-------|
| Frontend | Next.js 15, React 19, Tailwind 4 | 339 pages, 40+ component domains |
| API | App Router route handlers | 448 routes |
| Domain services | `src/server/services/` | 233 modules |
| Database | Prisma 6 + PostgreSQL | 632 models |
| Auth | Supabase Auth + SSR cookies | Middleware session only |
| Authorization | 318 permissions × 5 roles | App-layer RBAC |
| Tenancy | organisationId scoping | No DB RLS per tenant |
| AI | ai-request-service + providers | Mock fallback default |
| Providers | definitions + registries | Mostly disabled/mock |
| Publishing | Dual path (see workflows doc) | Path A real adapters |
| Scheduling | ContentSchedule + PublishingJob | Worker-dependent |
| Automation | Engine + Marketing Automation | Engine lacks emitters |
| Analytics | Canonical facts + warehouse | Ingestion partial |
| Notifications | In-app + email (Resend) | Digest worker external |
| Integrations | Stage 11 + Stage 12 APIs | Parallel legacy connectors |
| Background | Cron + GHA + worker tokens | Not fully on Vercel |
| Observability | requestId, audit logs | No APM integration |
| Security | encryption, RLS lockdown, secret scan | See security audit |

### Architectural violations / concerns

1. **Dual publishing systems** — ContentSchedule path vs Publication platform path
2. **Dual OAuth stacks** — `/api/connectors/oauth` vs `/api/integrations/oauth`
3. **Dual revoke semantics** — legacy disconnect vs Stage 12 revoke
4. **Dual automation** — Automation Engine vs Marketing Automation journeys
5. **Schema monolith** — 632 models in single `schema.prisma` (21k lines)
6. **Mock leakage** — social bootstrap registers only mock adapters for connect

---

## Deployment architecture (summary)

| Setting | Value |
|---------|-------|
| Build | `next build` (lean) |
| CI build | `build:ci` = validate routes/cron + build |
| postinstall | `prisma generate` |
| next.config | `ignoreBuildErrors`, `webpackMemoryOptimizations`, single CPU |
| Vercel cron | 1 job (daily-dispatch) |
| validate:vercel-build | PASS |
| typecheck | PASS (CI; skipped at build time) |
| lint | PASS (139 warnings) |
| build | PASS (~68s audit run) |

---

## Dead / legacy indicators

- `ContentCampaign` vs `Campaign` (canonical Stage 1 model alongside legacy)
- Legacy connector routes alongside Stage 12 integrations
- `comingSoon` nav flags on implemented features
- `/social` stub page despite Stage 2 completion

See `MODULE_INVENTORY.md` for per-module status.
