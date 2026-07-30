# Stage 2 Production Readiness

This document audits Stage 2 Social Media AI work (Tasks 2.1–2.20) and records the production-readiness posture before a public Stage 2 launch.

**Audit date:** 2026-07-29  
**Branch:** `cursor/social-ai-production-readiness-e94c`

## Launch recommendation

**Recommendation: NOT READY for unrestricted production launch.**

Stage 2 has substantial publishing, analytics, and content-studio foundations with strong automated test coverage and operational hardening added in Task 2.20. However, several blockers remain that make a full production launch premature. A **controlled internal pilot** with real provider credentials and manual oversight is appropriate; general-availability launch is not.

| Area | Status | Notes |
|------|--------|-------|
| Content model & approval | Ready | Approval workflow enforced; draft/AI content cannot publish |
| Publishing adapters | Ready (mocked CI) | Six providers implemented; CI uses mocked provider responses |
| Publishing scheduler | Ready (new) | Due `ContentSchedule` → `PublishingJob` worker added in 2.20 |
| Provider kill switches | Ready (new) | Per-provider and global emergency shutdown flags |
| Capability enforcement | Partial | Enforced at publish enqueue and scheduler; not all UI paths audited |
| Social OAuth | **Not ready** | `bootstrap.ts` registers **mock adapters only** — no production OAuth wiring on `main` |
| Social inbox | **Missing** | Not implemented on `main` |
| Video studio | **Missing** | Not implemented on `main` |
| Team ops / notifications / reporting | **Not merged** | Exists on separate PR branches, not on `main` |
| Analytics sync | Ready with restrictions | Scheduler and worker operational; provider data depends on live credentials |
| Credential encryption | Ready | AES-256-GCM for social tokens; rotation supported |
| Observability | Partial | Structured counters and logs; no external metrics backend wired |
| Test coverage | Ready | Unit, integration, and focused Stage 2 scenario tests |
| Documentation | Ready | Security review, runbooks, privacy, rollback, and checklists complete |

## What is production-ready

### Publishing pipeline (Tasks 2.6–2.10)
- Durable `PublishingJob` model with idempotency keys, attempt history, and provider state persistence
- Instagram, TikTok, LinkedIn, Facebook, YouTube, and X adapters with quota, token refresh, and manual-fallback paths
- Scheduling engine validates account, UTC time, assets, licence expiry, and variant state
- Publishing scheduler cron (`/api/publishing-scheduler/process-due`) enqueues due schedules and drains jobs
- Emergency provider shutdown via `PUBLISHING_DISABLE_<PROVIDER>` and `PUBLISHING_EMERGENCY_SHUTDOWN`

### Analytics (Tasks 2.11–2.14)
- Recurring analytics sync scheduler with idempotent windows
- Metric registry, normalised storage, and query APIs
- Credential isolation and token refresh

### Content studio (Tasks 2.4–2.5)
- AI Content Studio with brand-aware generation
- Platform variants per provider
- Visual Studio for licensed image/carousel assets

### Security foundations
- Tenant-scoped data access on all services
- RBAC enforced server-side
- Social credential encryption at rest
- Worker endpoints protected by `PUBLISHING_WORKER_TOKEN`

## Blockers for production launch

### 1. Mock OAuth adapters only (critical)
`src/lib/social/bootstrap.ts` calls `registerAllMockSocialAdapters()`. Production OAuth flows, token exchange, and account discovery against real provider APIs are not wired on `main`. Connecting a real Instagram or TikTok account in production would not work without replacing mock registration with production adapters.

### 2. Missing product surfaces
- **Social inbox** — no unified comment/DM inbox on `main`
- **Video studio** — no video creation/editing workflow on `main`
- **Notifications, team ops, reporting** — implemented on separate branches, not merged

### 3. Operational gaps
- No external error monitoring (Sentry/Datadog) wired — console abstraction only
- In-memory rate limiter (not distributed)
- Publishing scheduler GitHub Action requires `APP_URL` and `PUBLISHING_WORKER_TOKEN` secrets configured per environment
- Real-provider sandbox validation is an operational activity, not automated in CI

### 4. Accessibility and compliance
- Full WCAG 2.1 AA audit not completed for Stage 2 UI
- GDPR/data-subject request automation not implemented (see `docs/SOCIAL_DATA_PRIVACY.md`)

## Pilot deployment criteria

If proceeding with a **restricted pilot** (single brand, manual monitoring):

| Requirement | Status |
|-------------|--------|
| Replace mock OAuth with production adapters | Required before any real account connection |
| Configure `PUBLISHING_WORKER_TOKEN` in production | Required |
| Enable publishing scheduler cron | Required |
| Provider app review completed (Meta, TikTok, etc.) | Required per provider |
| Backup taken before migration | Required |
| On-call runbooks distributed | Required |
| Incident response contacts configured | Required |

## Environment isolation

See `docs/ENVIRONMENT.md`. Stage 2 adds:

| Variable | Purpose |
|----------|---------|
| `PUBLISHING_WORKER_TOKEN` | Authenticates scheduler and worker endpoints |
| `PUBLISHING_SCHEDULER_ENABLED` | Master switch for scheduled publishing |
| `PUBLISHING_EMERGENCY_SHUTDOWN` | Global publishing kill switch |
| `PUBLISHING_DISABLE_<PROVIDER>` | Per-provider kill switch |
| `SOCIAL_ANALYTICS_SYNC_ENABLED` | Master switch for analytics scheduler |

## CI/CD

Pull Request CI: lint, typecheck, unit tests, integration tests, build, Prisma validate, secret scan.

Scheduled:
- Publishing scheduler (every 5 minutes when secrets configured)
- Social analytics scheduler (every 6 hours)
- Playwright E2E (weekly)
- Security audit (weekly)

## Sign-off

| Check | Required | Status |
|-------|----------|--------|
| All PR CI jobs pass | Yes | Pending this PR |
| `npm run build` passes | Yes | Pending |
| Publishing scheduler implemented | Yes | Done (2.20) |
| Capability checks at enqueue | Yes | Done (2.20) |
| Documentation complete | Yes | Done (2.20) |
| Mock OAuth replaced | Yes | **Not done** |
| Social inbox / video studio | Per product scope | **Not on main** |
| Production launch authorised | Yes | **Not authorised** |

## Related documents

- `docs/STAGE_2_SECURITY_REVIEW.md`
- `docs/SOCIAL_DATA_PRIVACY.md`
- `docs/STAGE_2_RELEASE_CHECKLIST.md`
- `docs/STAGE_2_KNOWN_LIMITATIONS.md`
- `docs/SOCIAL_PROVIDER_RUNBOOK.md`
- `docs/PUBLISHING_INCIDENT_RUNBOOK.md`
- `docs/CONNECTOR_RECOVERY_RUNBOOK.md`
- `docs/VIDEO_RENDERING_RUNBOOK.md`
- `docs/STAGE_2_ROLLBACK.md`
