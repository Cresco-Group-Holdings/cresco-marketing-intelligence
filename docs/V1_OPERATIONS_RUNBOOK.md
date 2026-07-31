# V1 Operations Runbook

Daily and weekly operational procedures for V1 production across all stages.

## Health checks

| Endpoint | Purpose | Expected |
|----------|---------|----------|
| `GET /api/health` | Liveness | `200` |
| `GET /api/readiness` | DB, env, job system, module checks | `200` (warn acceptable) |
| `GET /api/advertising/metrics` | Advertising counters | Requires permission |
| `GET /api/ai/usage` | AI cost tracking | Admin access |

Readiness checks include: `database`, `environment`, `job_system`, `connector_diagnostics`, `seo_engine`, `advertising_platform`.

## Daily operations

### Platform health (15 min)

1. Verify `/api/health` and `/api/readiness` return 200
2. Review error log drain for spikes (>10 errors/minute)
3. Check failed job count (connector syncs, email dispatch, automation steps)
4. Verify `ALLOW_AI_DIAGNOSTICS` is false in production

### Data freshness (15 min)

1. Navigate to `/analytics/executive/data-health` or `/data/health`
2. Review unhealthy/degraded sources
3. Re-sync failed connectors from `/connectors`
4. Check GSC freshness (expect 2–3 day delay)

### Email operations (10 min)

1. Review email campaign analytics for bounce/complaint spikes
2. Check suppression list growth (unexpected spikes → investigate)
3. Verify queued messages processing (no stuck `QUEUED` > 1 hour)
4. Review tenant quota usage

### CRM operations (10 min)

1. Review lifecycle agent runs for failed/blocked analyses
2. Check automation enrollment errors
3. Review quarantined form submissions
4. Verify lead scoring jobs completing

### Advertising (if enabled, 10 min)

1. Review `/advertising/budgets/alerts` for CRITICAL alerts
2. Check provider connection health in Settings → Connections
3. Verify no active emergency incidents
4. Review `launch_failure` counter

### SEO (if enabled, 10 min)

1. Check `SeoCrawlQueueItem` PENDING count (alert if > 1000)
2. Review failed crawl jobs
3. Verify rank tracking sync status

## Weekly operations

### Analytics and reporting

1. Run AI analyst weekly executive brief per brand
2. Review executive dashboard operational warnings
3. Reconcile Stripe revenue if configured
4. Review attribution model outputs for anomalies

### Email and automation

1. Review email deliverability trends (open/click/bounce rates)
2. Audit active automation journeys for enrollment errors
3. Review lead scoring model performance vs simulation
4. Verify domain authentication (SPF/DKIM/DMARC) still valid

### Advertising (weekly)

1. Run weekly optimisation review per brand
2. Reconcile spend against provider billing
3. Review experiment validity checks
4. Audit launch approval completion rates

### SEO (weekly)

1. Review content decay signals and refresh queue
2. Check rank tracking data freshness
3. Review competitor crawl quota usage

### Security and compliance

1. Review `SecurityAuditLog` for anomalous patterns
2. Check failed auth rate limit events
3. Verify backup completion (see `V1_BACKUP_RECOVERY.md`)
4. Review AI usage costs vs budget

## Sync procedures

| Source | Route / UI |
|--------|-----------|
| Warehouse | `/data` → sync |
| Stripe | `/analytics/revenue` → Sync Stripe |
| GSC | `/analytics/search` → sync |
| Paid ads | `/connectors` → sync |
| Social | `/analytics/social` → sync |
| SEO crawl | `/seo/sites` → enqueue crawl |
| Rank tracking | `/seo/rank-tracking` → sync |

## Emergency procedures

| Situation | Action |
|-----------|--------|
| Advertising runaway spend | `ADVERTISING_EMERGENCY_SHUTDOWN=true` + org freeze |
| SEO crawl abuse | `SEO_ENGINE_SHUTDOWN=true` |
| Email deliverability crisis | Pause all campaigns; review suppressions |
| Cross-tenant concern | Revoke affected routes; preserve audit logs |
| Database connectivity | Check provider status; verify connection strings |

See `docs/V1_INCIDENT_RESPONSE.md` and `docs/V1_ROLLBACK_PLAN.md`.

## Deployment procedure

1. Run CI gates (lint, tests, validate migrations)
2. Confirm pre-migration backup
3. Deploy to staging; run V1 E2E smoke scenario
4. `npm run db:migrate:deploy` on production
5. Deploy application to production
6. Verify readiness and smoke tests
7. Monitor for 30 minutes post-deploy

## Environment flags reference

| Flag | Default (prod) | Effect |
|------|----------------|--------|
| `ALLOW_TEST_AUTH` | `false` | Blocks test auth bypass |
| `ALLOW_AI_DIAGNOSTICS` | `false` | Disables AI diagnostics |
| `ALLOW_DEV_SEED` | unset | Blocks dev seed |
| `ADVERTISING_EMERGENCY_SHUTDOWN` | `false` | Blocks ad mutations |
| `SEO_ENGINE_SHUTDOWN` | `false` | Blocks crawl enqueue |

## Related runbooks

| Document | Scope |
|----------|-------|
| `docs/MARKETING_ANALYTICS_RUNBOOK.md` | Stage 3 analytics |
| `docs/ADVERTISING_PLATFORM_RUNBOOK.md` | Stage 5 advertising |
| `docs/SEO_CRAWLER_RUNBOOK.md` | Stage 4 crawler |
| `docs/SEO_PROVIDER_RUNBOOK.md` | Stage 4 providers |
| `docs/AUTOMATION_OPERATIONS.md` | Stage 6 automation |
| `docs/EMAIL_DELIVERABILITY.md` | Stage 6 email |
| `docs/V1_LAUNCH_MONITORING.md` | Launch monitoring plan |

## On-call handoff checklist

- [ ] Readiness status green or known warns documented
- [ ] Open incidents and their status
- [ ] Pending deployments or migrations
- [ ] Active emergency flags
- [ ] Beta tenant issues from support queue
