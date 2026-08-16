# Test & CI Audit

**Main SHA:** `8910740` | **Audit date:** 2026-08-16

---

## Test inventory

| Layer | Files | Tests (audit run) | Result |
|-------|-------|-------------------|--------|
| Unit | 196 | 1,548 | **PASS** |
| Integration | 73 | 434 | **PASS** |
| Database | 6 | 70 | **PASS** |
| E2E (Playwright) | 9 | not executed in audit | — |
| **Total executed** | **275** | **2,052** | **0 failed** |

### E2E specs (not run in audit)

| File | Focus |
|------|-------|
| `smoke.spec.ts` | Basic smoke |
| `auth.spec.ts` | Auth flows |
| `onboarding.spec.ts` | Onboarding |
| `workspace.spec.ts` | Workspace |
| `stage-1-foundation.spec.ts` | Foundation |
| `publishing-platform.spec.ts` | Path B mock gateway |
| `integrations-platform.spec.ts` | Integrations UI |
| `collaboration-platform.spec.ts` | Comments/inbox |
| `seo-crawler.spec.ts` | SEO |

---

## Test architecture by domain

| Domain | Unit | Integration | Database | E2E | Coverage assessment |
|--------|------|-------------|----------|-----|---------------------|
| Auth/Workspace | ✓ | ✓ | — | ✓ | Good |
| Campaigns | ✓ | ✓ | — | partial | Good |
| Content | ✓ | ✓ | — | — | Good |
| Calendar | ✓ | ✓ | — | — | Good |
| Publishing (Path A) | ✓ | ✓ | — | — | Good (mocked HTTP) |
| Publication platform | ✓ | ✓ | — | ✓ | Good (mock gateway) |
| Providers/OAuth | ✓ | ✓ | — | partial | Good |
| CRM | ✓ | ✓ | — | — | Moderate |
| SEO | ✓ | ✓ | ✓ | ✓ | Good |
| Advertising | ✓ | ✓ | — | — | Moderate |
| Analytics/Warehouse | ✓ | ✓ | ✓ | — | Moderate |
| AI/Agents | ✓ | ✓ (mocked) | — | — | Moderate |
| Automation Engine | ✓ | ✓ (mocked) | — | — | Moderate |
| RLS | ✓ | — | ✓ | — | Good |
| Billing | ✓ | partial | — | — | Low |
| Notifications | ✓ | ✓ | — | partial | Moderate |

---

## False confidence risks

| Risk | Evidence |
|------|----------|
| Mocked Prisma in integration tests | Most `tests/integration/*` mock prisma or services |
| Mocked provider HTTP | All publishing integration tests mock adapter responses |
| No live OAuth E2E | `integrations-oauth-security.test.ts` tests crypto, not real providers |
| No live LLM tests | `ai-request-service.test.ts` injects mock provider |
| Agent platform routes mock service | `agent-platform-routes.test.ts` |
| Automation event triggers untested | No test for domain event → workflow dispatch |
| E2E covers mock publishing only | `publishing-platform.spec.ts` — Path B |
| SCHEDULE trigger execution untested | automation-engine tests cover EVENT only |
| Stale fixture risk | Mitigated by `MOCK_ADVERTISING_CAPABILITIES` pattern (PR #124) |

---

## CI architecture (Phase 20)

### Workflows

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `pull-request.yml` | PR to main | changes, quality, test, database-tests (if prisma), build (label-gated) |
| `main-branch.yml` | Push to main | quality, test, database-tests, build |
| `playwright-e2e.yml` | PR (skipped by default policy) | smoke |
| `social-analytics-scheduler.yml` | Cron 6h + dispatch | schedule sync |
| `vercel-preview-opt-in.yml` | PR | preview marker |
| `scheduled-security-audit.yml` | Weekly | npm audit |
| `scheduled-dependency-review.yml` | Weekly | deps |

### Quality gates (PR/main)

```
npm ci → prisma generate → lint → typecheck → validate:prisma →
validate:migrations → validate:routes → validate:vercel-cron →
validate:vercel-build → audit:secrets → test:unit → test:integration
```

### Build architecture

| Setting | Value |
|---------|-------|
| `build` | `next build` |
| `build:ci` | validate routes/cron + build |
| `postinstall` | `prisma generate` |
| NODE_OPTIONS (build) | None (OOM fix) |
| NODE_OPTIONS (typecheck) | `--max-old-space-size=8192` |
| next.config | `ignoreBuildErrors: true`, `webpackMemoryOptimizations: true` |
| Vercel cron | 1 daily dispatch |

### Audit execution timings

| Step | Duration | Result |
|------|----------|--------|
| test:unit | ~14s | PASS |
| test:integration | ~9s | PASS |
| test:database | ~186s | PASS |
| typecheck | ~128s | PASS |
| lint | ~15s | PASS (139 warnings) |
| build | ~68s | PASS |
| prisma validate | <1s | PASS |
| validate:migrations | <1s | PASS |
| validate:vercel-build | <1s | PASS |
| validate:rls-security | <1s | PASS |

### OOM / SIGKILL risk

- **Mitigated:** build skips TypeScript validation; webpack memory optimizations; single CPU
- **Residual risk:** `prisma generate` in postinstall can be slow/memory-heavy on constrained builders
- **Vercel Hobby:** Documented in `docs/deployment/VERCEL_BUILD.md`; lean build validated

### Duplicate work

- `prisma generate` in postinstall + explicit CI step (acceptable)
- No tests/lint in Vercel build script (correct)

### Deployability assessment

**Main is deployable on configured Vercel tier** assuming:
- Environment variables set (DATABASE_URL, Supabase, ENCRYPTION_KEY, worker secrets)
- External worker/cron for publishing beyond daily-dispatch pass
- Acceptance of build-time typecheck skip

---

## Skipped / policy-gated CI

- Playwright E2E: skipped unless labeled
- PR production build: requires `ci/build` or `ready-to-merge` label
- Database tests: on prisma changes or `run-database-tests` label

---

## Module test coverage estimate

| Module | Approx. coverage |
|--------|------------------|
| Core platform | 75% |
| Publishing | 70% |
| Providers | 65% |
| CRM | 55% |
| Advertising | 50% |
| AI/Agents | 45% |
| Billing | 30% |
| E2E product flows | 20% |

*Estimates based on test file presence and mock ratio, not line coverage.*
