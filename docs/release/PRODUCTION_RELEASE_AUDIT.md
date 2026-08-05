# Production Release Audit

**Project:** Cresco Marketing Intelligence V1  
**Audit date:** 2026-08-05  
**Auditor:** Stage 18 release programme (automated + codebase review)  
**Final decision:** **CONDITIONALLY READY**

## Executive summary

Cresco Marketing Intelligence is **production-viable for controlled beta launch** with documented restrictions. The platform has strong automated test coverage (1,315 unit + 363 integration tests), validated migrations (68), passing typecheck and production build, tenant isolation controls, and human-in-the-loop governance on all material customer-facing actions.

**Unrestricted public self-serve launch is not recommended** until SaaS billing enforcement and automated E2E V1 scenario coverage are complete.

## Verification evidence (2026-08-05)

| Gate | Command / artefact | Result |
|------|-------------------|--------|
| Typecheck | `npm run typecheck` | ✅ PASS |
| Unit tests | `npm run test:unit` | ✅ 1,315 passed (173 files) |
| Integration tests | `npm run test:integration` | ✅ 363 passed (59 files) |
| Migration validation | `npm run validate:migrations` | ✅ 68 migrations |
| Schema validation | `npx prisma validate` | ✅ PASS |
| Route validation | `npm run validate:routes` | ✅ PASS |
| Production build | `npm run build` | ✅ PASS (prior verification) |
| Tenant isolation | `tests/unit/v1-tenant-isolation.test.ts` | ✅ PASS |
| Commercial safety | `tests/unit/v1-production-readiness.test.ts` | ✅ PASS |
| Secret scan | `npm run audit:secrets` (CI) | ✅ in pipeline |
| CI pipeline | `.github/workflows/main-branch.yml` | lint, typecheck, test, build |

## Full product audit

### Onboarding
- **Status:** Production Ready
- **Evidence:** `onboarding-service.ts`, `/onboarding` wizard, `tests/e2e/onboarding.spec.ts`
- **Notes:** Redirect policy enforces completion before dashboard access

### Authentication
- **Status:** Production Ready
- **Evidence:** Supabase Auth, `/login`, `/signup`, rate limits, `tests/integration/auth-signup.test.ts`
- **Fix applied:** Empty env vars no longer override valid Supabase public config

### Workspace context
- **Status:** Production Ready
- **Evidence:** `brandService.getById` on all brand ops, `withApiHandler`, middleware tenant resolution

### Dashboard
- **Status:** Production Ready
- **Route:** `/dashboard` — workspace summary

### Campaigns
- **Status:** Production Ready
- **Route:** `/campaigns` — content campaign coordination

### Knowledge Base
- **Status:** Production Ready
- **Routes:** `/knowledge` (redirect), `/brands/[id]/knowledge`

### Assets
- **Status:** Production Ready
- **Routes:** `/assets`, brand-scoped assets

### Content Studio
- **Status:** Production Ready
- **Route:** `/content` — full approval workflow with notifications

### Tasks
- **Status:** Production Ready
- **Route:** `/tasks`

### Calendar
- **Status:** Coming Soon
- **Route:** `/calendar` — `ModuleEmptyState` only; nav shows "Soon"

### Analytics
- **Status:** Beta
- **Routes:** `/analytics/*` — GA4, GSC, social, attribution, executive
- **Caveats:** Data freshness delays documented in `KNOWN_LIMITATIONS.md`

### CRM
- **Status:** Beta
- **Routes:** `/crm/*` — leads, contacts, pipelines, opportunities, scoring

### Automation
- **Status:** Beta
- **Route:** `/automation` — graph validation, cycle detection, webhook approval gates

### AI Agents
- **Status:** Coming Soon
- **Route:** `/ai-agents` — placeholder; individual AI features live under Analyst, Assistant, Optimisation

### Integrations
- **Status:** Beta
- **Routes:** `/integrations`, `/connectors/*`
- **Evidence:** Provider platform (Stage 7), mock adapters, Resend live

### Publishing
- **Status:** Beta
- **Route:** `/publishing` — governed outbound operations (Stage 14)

### Notifications
- **Status:** Production Ready
- **Routes:** `/notifications`, `/inbox` — unified inbox (Stage 15)

### Billing
- **Status:** Disabled (SaaS)
- **Notes:** Stripe connector is for **customer revenue analytics**, not platform subscriptions

### Settings / Admin
- **Status:** Production Ready
- **Routes:** `/settings/*` — org, members, audit, projects, security

## Route safety audit

| Risk | Finding |
|------|---------|
| Blank pages | 2 placeholders (`/calendar`, `/ai-agents`) — correctly labeled Coming Soon |
| Permanently loading | None identified in code review |
| Silently failing | API errors use `AppError` + structured JSON responses |
| Misleading UI | Advertising and AI modules include disclaimers; nav "Soon" badges on stubs |
| Cross-tenant unsafe | No findings; isolation tested |

**Dashboard routes:** 312 `page.tsx` files under `src/app/(dashboard)/`

## Environment audit

| Environment | Isolation | Status |
|-------------|-----------|--------|
| Development | Local `.env`; placeholder keys flagged by `classifyProductionEnvironment()` | ✅ |
| Preview (Vercel) | Per-branch deployment; separate env vars | ✅ (verify per deploy) |
| Staging | Documented in `docs/DEPLOYMENT.md` | ⚠️ Manual verification required |
| Production | `classifyProductionEnvironment()` blockers | ⚠️ Requires real Supabase/DB URLs |

**Checks:**
- Database isolation: `organisationId` on all tenant tables ✅
- Provider credentials: AES-256-GCM encryption ✅
- OAuth redirects: per-provider config in env ✅
- Webhook URLs: documented per provider ✅
- Encryption key: `ENCRYPTION_KEY` required ✅
- Emergency shutdown flags: advertising, SEO, email, publishing ✅
- Feature flags: env + `ProviderFeatureFlag` DB model ✅

## Performance notes

| Area | Threshold | Status |
|------|-----------|--------|
| Unit test suite | < 15s | ✅ ~11s |
| Integration suite | < 10s | ✅ ~6s |
| Typecheck | < 90s | ✅ ~36s |
| Production build | < 10 min | ✅ ~6 min (includes prisma generate) |
| API p95 | < 500ms target | ⚠️ Not load-tested; spot-check recommended |
| Large lists | Cursor pagination on inbox/notifications | ✅ |

## Legal and compliance

| Document | Location | Status |
|----------|----------|--------|
| Privacy Policy | `/privacy` | ⚠️ Exists; legal review required |
| Terms of Service | `/terms` | ⚠️ Exists; legal review required |
| Cookie Policy | — | ⚠️ Not standalone page |
| DPA / Subprocessors | `docs/V1_PRIVACY_REVIEW.md` | Documented; legal review required |
| AI usage disclosure | AI disclaimers in UI + `docs/V1_AI_SAFETY_REVIEW.md` | ✅ |
| Data retention | `docs/V1_DATA_RETENTION.md` | ✅ |
| Deletion process | `docs/V1_PRIVACY_REVIEW.md` | ✅ |

## Customer operations

| Artefact | Location |
|----------|----------|
| Support runbook | `docs/V1_SUPPORT_RUNBOOK.md` |
| Operations runbook | `docs/V1_OPERATIONS_RUNBOOK.md` |
| Known limitations | `docs/release/KNOWN_LIMITATIONS.md` |
| Provider matrix | `docs/V1_PROVIDER_MATRIX.md` |
| Incident response | `docs/release/INCIDENT_RESPONSE_PLAN.md` |

## Release pipeline

| Control | Status |
|---------|--------|
| Protected main branch | Documented in `docs/CI_BRANCH_PROTECTION.md` |
| Required checks | lint, typecheck, validate:*, test:unit, test:integration, build |
| Preview deployment | Vercel per PR |
| Production migration gate | `.github/workflows/production-database-migrate.yml` |
| Smoke tests | `playwright-smoke.yml` (label `run-e2e`) |
| Rollback | `docs/release/ROLLBACK_PLAN.md` |
| Release tags | Manual via GitHub releases |

## Launch decision

### CONDITIONALLY READY

**Rationale:**
- All BLK gates pass
- No P0 security or tenant-isolation blockers
- P1 items (no SaaS billing, manual E2E) acceptable for **controlled beta** per `V1_SCOPE.md`
- Human-in-the-loop enforced on all material actions

**Conditions for launch:**
1. Beta tenant list only (no public self-serve)
2. Manual smoke test execution per `SMOKE_TEST_PLAN.md`
3. Legal review of `/privacy` and `/terms` before external marketing
4. Production env vars verified via `classifyProductionEnvironment()`
5. Post-deploy monitoring per `docs/V1_LAUNCH_MONITORING.md` (first 72 hours)

## Related documents

All release artefacts in `docs/release/`:

- `V1_SCOPE.md` — frozen scope and module classification
- `RELEASE_BLOCKERS.md` — open/closed blockers
- `RELEASE_SCORE.md` — scored dimensions
- `SECURITY_RELEASE_REVIEW.md` — security sign-off
- `DATA_MIGRATION_PLAN.md` — migration procedure
- `ROLLBACK_PLAN.md` — rollback procedures
- `SMOKE_TEST_PLAN.md` — manual E2E scenarios
- `INCIDENT_RESPONSE_PLAN.md` — incident handling
- `KNOWN_LIMITATIONS.md` — honest capability inventory
- `POST_LAUNCH_BACKLOG.md` — post-V1 engineering backlog
- `V1_RELEASE_NOTES.md` — customer-facing release notes
