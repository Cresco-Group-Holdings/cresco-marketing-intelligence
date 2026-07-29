# Stage 2 Rollback Procedure

Rollback guidance specific to Stage 2 Social Media AI features.

## Principles

1. Prefer **forward fixes** (new migration + redeploy) over schema rollback.
2. Never rollback database migrations automatically in production.
3. Use **kill switches** for immediate publishing/analytics containment without redeploying.
4. Keep rollback scope limited to application deployment where possible.

## Immediate containment (no redeploy)

### Stop all publishing
```bash
PUBLISHING_EMERGENCY_SHUTDOWN=true
```

### Stop all analytics sync
```bash
SOCIAL_ANALYTICS_SYNC_ENABLED=false
```

### Stop schedulers
Disable GitHub Actions workflows:
- `Publishing Scheduler` (`.github/workflows/publishing-scheduler.yml`)
- `Social Analytics Scheduler` (`.github/workflows/social-analytics-scheduler.yml`)

Or set in environment:
```bash
PUBLISHING_SCHEDULER_ENABLED=false
SOCIAL_ANALYTICS_SYNC_ENABLED=false
```

## Application rollback (Vercel)

1. Open the Vercel project → Deployments.
2. Identify the last known-good production deployment (pre-Stage 2 or last stable Stage 2 build).
3. Click **Promote to Production** on that deployment.
4. Verify:
   - `GET /api/health` → `200`
   - `GET /api/readiness` → `200`
   - Login flow works
   - Publishing kill switches active if incident ongoing
5. Monitor error logs for 30 minutes.

**Note:** Rolling back the application does not remove Stage 2 database tables or data. Older application versions may not recognise new schema columns but Prisma forward-compatible migrations should not break reads.

## Database rollback

Prisma does not support automatic down migrations in production.

If a Stage 2 migration caused issues:

1. **Stop** further deploys and schedulers.
2. Assess whether a forward migration can fix the schema safely.
3. If data repair is required, restore from backup (see `docs/BACKUP_RECOVERY.md`).
4. Document the incident per `docs/INCIDENT_RESPONSE.md`.

### Stage 2 tables (do not drop without backup)

Key Stage 2 models:
- `ContentItem`, `ContentVariant`, `ContentSchedule`
- `PublishingJob`, `PublishingAttempt`
- `SocialAccount`, `SocialConnection`, `SocialConnectionCredential`
- `SocialAnalyticsSync`, `SocialPostMetric`, `SocialMetricSnapshot`
- `TikTokPublishSetting`

## Configuration rollback

1. Revert Stage 2 environment variables in Vercel:
   - `PUBLISHING_WORKER_TOKEN`
   - `PUBLISHING_SCHEDULER_ENABLED`
   - `PUBLISHING_EMERGENCY_SHUTDOWN`
   - `PUBLISHING_DISABLE_*`
   - `SOCIAL_ANALYTICS_SYNC_ENABLED`
   - Provider OAuth client IDs/secrets
2. Redeploy or wait for next deployment to pick up changes.
3. Verify OAuth redirect URLs match `APP_URL`.

## Scheduler rollback

If the publishing scheduler causes issues:

1. Disable workflow: GitHub → Actions → Publishing Scheduler → Disable
2. Set `PUBLISHING_SCHEDULER_ENABLED=false`
3. In-flight `PublishingJob` records remain in database — they will not be processed until scheduler re-enabled
4. To clear stuck jobs: update `PublishingJob.status` to `FAILED` with reason (operator action, document in ticket)

## Credential rollback

If encryption key was changed incorrectly:

1. **Stop** all publishing and analytics immediately
2. Restore database from pre-rotation backup
3. Restore previous `ENCRYPTION_KEY` in environment
4. Have all tenants reconnect social accounts if backup unavailable

See `docs/CONNECTOR_RECOVERY_RUNBOOK.md`.

## When NOT to rollback

- Security patch already deployed — fix forward instead
- Migration already applied with publishing job data that would be orphaned
- Rollback would expose previously fixed vulnerability
- Rollback would leave scheduled posts in ambiguous state without operator review

## Post-rollback validation

- [ ] Health and readiness endpoints return 200
- [ ] Auth flow works
- [ ] No publishing jobs being processed (if intentional)
- [ ] Stage 1 features (dashboard, assets, knowledge) functional
- [ ] Affected tenants notified
- [ ] Post-incident review scheduled

## Communication

Follow `docs/INCIDENT_RESPONSE.md` for stakeholder notification.

## Related

- `docs/ROLLBACK.md` — Stage 1 rollback (general)
- `docs/PUBLISHING_INCIDENT_RUNBOOK.md`
- `docs/BACKUP_RECOVERY.md`
