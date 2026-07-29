# Stage 2 Release Checklist

Use this checklist before promoting a Stage 2 build to production or enabling a restricted pilot.

## Pre-release

- [ ] All Pull Request CI jobs pass on the release branch
- [ ] `npm run lint` passes locally
- [ ] `npm run typecheck` passes locally
- [ ] `npm run test` passes locally (unit + integration)
- [ ] `npm run build` passes locally
- [ ] `npm run validate:prisma` passes
- [ ] `npm run validate:migrations` passes
- [ ] `npm run audit:secrets` passes
- [ ] `npm run audit:deps` reviewed (no unresolved high/critical)
- [ ] Stage 2 focused scenario test passes (`tests/integration/stage-2-e2e-scenario.test.ts`)

## Environment

- [ ] Production database provisioned and isolated from preview/dev
- [ ] `APP_URL` set to production canonical URL
- [ ] `PUBLISHING_WORKER_TOKEN` generated and stored in secrets (unique per environment)
- [ ] `ENCRYPTION_KEY` unique for production (min 32 chars)
- [ ] `PUBLISHING_SCHEDULER_ENABLED=true` in production
- [ ] `SOCIAL_ANALYTICS_SYNC_ENABLED=true` in production
- [ ] Provider OAuth apps configured with production redirect URLs
- [ ] `ALLOW_TEST_AUTH` unset or `false` in production
- [ ] `ALLOW_DEV_SEED` unset in production
- [ ] Marketing asset storage bucket configured for production
- [ ] **Mock OAuth adapters replaced with production adapters** (blocker)

## Provider configuration

- [ ] Meta app review completed (Instagram + Facebook publishing)
- [ ] TikTok app review completed
- [ ] LinkedIn app permissions approved
- [ ] Google/YouTube API quota configured
- [ ] X API access tier confirmed
- [ ] Provider webhook URLs configured (where applicable)
- [ ] Per-provider kill switch env vars documented (`PUBLISHING_DISABLE_<PROVIDER>`)

## Database

- [ ] Backup taken before migration (see `docs/BACKUP_RECOVERY.md`)
- [ ] `npm run db:migrate:deploy` executed against production
- [ ] Migration success verified in deployment logs
- [ ] Social metric definitions seeded

## Deployment (Vercel)

- [ ] Preview deployment smoke-tested
- [ ] Production deployment created (manual promotion)
- [ ] `GET /api/health` returns `200`
- [ ] `GET /api/readiness` returns `200` with database check passing
- [ ] Auth login/logout/callback verified on production URL
- [ ] Publishing scheduler GitHub Action secrets configured (`APP_URL`, `PUBLISHING_WORKER_TOKEN`)
- [ ] Analytics scheduler GitHub Action secrets configured

## Functional validation

- [ ] User can connect a real social account (requires production adapters)
- [ ] AI Content Studio generates brand-aware content
- [ ] Content approval workflow blocks publishing from draft state
- [ ] Scheduling validates account, time, assets, and licence
- [ ] Due schedule creates `PublishingJob` via scheduler
- [ ] Publishing worker dispatches to provider and stores post ID
- [ ] Failed publish produces actionable error in UI
- [ ] Analytics sync runs on schedule and stores metrics
- [ ] Emergency provider shutdown flag stops publishing
- [ ] Cross-tenant access attempts return 403/404
- [ ] Disconnect removes encrypted credentials

## Operational readiness

- [ ] `docs/SOCIAL_PROVIDER_RUNBOOK.md` distributed to on-call
- [ ] `docs/PUBLISHING_INCIDENT_RUNBOOK.md` distributed to on-call
- [ ] `docs/CONNECTOR_RECOVERY_RUNBOOK.md` distributed to on-call
- [ ] `docs/VIDEO_RENDERING_RUNBOOK.md` reviewed (video studio not on `main`)
- [ ] `docs/STAGE_2_ROLLBACK.md` accessible
- [ ] Incident response contacts configured (`docs/INCIDENT_RESPONSE.md`)
- [ ] Uptime monitor on `/api/health` and `/api/readiness`

## Post-release

- [ ] Monitor publishing scheduler logs for first 24 hours
- [ ] Monitor analytics scheduler logs for first 24 hours
- [ ] Verify no duplicate publishes (idempotency)
- [ ] Record release version and migration ID in change log
- [ ] Keep rollback plan accessible (`docs/STAGE_2_ROLLBACK.md`)

## Launch decision

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | |
| Security | | | |
| Product | | | |

**Current recommendation:** NOT READY — see `docs/STAGE_2_PRODUCTION_READINESS.md`
