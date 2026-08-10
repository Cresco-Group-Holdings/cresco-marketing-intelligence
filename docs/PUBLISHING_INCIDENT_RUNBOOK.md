# Publishing Incident Runbook

Response procedures for publishing pipeline incidents.

## Severity guide

| Severity | Examples | Response |
|----------|----------|----------|
| S1 | Duplicate posts live, credential leak, all publishing down | Immediate — activate kill switch |
| S2 | Single provider down, elevated failure rate, stuck jobs | < 1 hour — disable provider, investigate |
| S3 | Individual job failures, slow polling | < 4 hours — review logs, retry |
| S4 | UI display issue, non-blocking warning | Next business day |

## Immediate containment

### Stop all publishing
```bash
PUBLISHING_EMERGENCY_SHUTDOWN=true
```
Set in Vercel environment. Scheduler and enqueue paths honour this immediately.

### Stop a single provider
```bash
PUBLISHING_DISABLE_INSTAGRAM=true
PUBLISHING_DISABLE_TIKTOK=true
# etc.
```

### Stop the scheduler only (allow manual publish)
```bash
PUBLISHING_SCHEDULER_ENABLED=false
```

## Investigation steps

### 1. Check scheduler health
- Verify **Vercel Cron** is configured (`vercel.json` → `/api/cron/daily-dispatch`, once daily on Hobby; see `docs/PUBLISHING_SCHEDULER.md`)
- Confirm `CRON_SECRET` is set in Vercel (cron auth) and `PUBLISHING_WORKER_TOKEN` for manual runs
- See `docs/PUBLISHING_SCHEDULER.md` for full operations
- Emergency only: GitHub Actions **Publishing Scheduler (manual fallback only)** via `workflow_dispatch` — not the production scheduler

### 2. Check recent logs
Search for:
- `publishing.scheduler_run` — enqueued/skipped counts
- `publishing.jobs_failed` — failure details
- `publishing.provider_shutdown_skipped` — kill switch active
- `publishing.capability_blocked` — permission issues

### 3. Inspect stuck jobs
Query `PublishingJob` where:
- `status` = `PROCESSING` and `nextPollAt` < now (overdue poll)
- `status` = `QUEUED` and `createdAt` > 30 minutes ago
- `status` = `FAILED` with recent `lastProviderError`

### 4. Check for duplicate publishes
- `publishedMediaId` has unique constraint — duplicates prevented at DB level
- Verify idempotency keys: `schedule:{contentScheduleId}` for scheduled posts
- Review `PublishingAttempt` history for unexpected retries

## Common incident scenarios

### Duplicate post suspected
1. Check `PublishingJob.publishedMediaId` — unique constraint prevents DB-level duplicates
2. Review `PublishingAttempt` records for the job
3. Check provider-side post ID matches `publishedMediaId`
4. If confirmed duplicate at provider: delete post at provider; document in post-mortem
5. **Do not** delete `PublishingJob` records (audit trail)

### All publishes failing for one provider
1. Set `PUBLISHING_DISABLE_<PROVIDER>=true`
2. Check provider status page (Meta, TikTok, etc.)
3. Verify OAuth app is in Live mode and not suspended
4. Check token refresh errors in logs
5. Test with a single manual publish after fix

### Scheduler not enqueuing due schedules
1. Verify `PUBLISHING_SCHEDULER_ENABLED` is not `false`
2. Check `ContentSchedule` status is `READY` and `scheduledFor` <= now
3. Verify social account is `CONNECTED` with valid capabilities
4. Check for `PROVIDER_DISABLED` or `CAPABILITY_BLOCKED` in skip logs

### Jobs stuck in PROCESSING
1. Instagram/TikTok jobs poll provider for container/publish status
2. Check `pollingAttemptCount` vs max attempts (12 Instagram, 20 TikTok)
3. If max exceeded, job should transition to FAILED
4. Manual intervention: update job status to FAILED and notify user

### Token refresh failure cascade
1. Set provider kill switch
2. Identify affected accounts via `reconnectRequiredAt`
3. Notify affected tenants to reconnect
4. See `docs/CONNECTOR_RECOVERY_RUNBOOK.md`

## Recovery

1. Remove kill switch environment variables
2. Trigger manual scheduler run via GitHub Actions `workflow_dispatch`
3. Monitor `publishing.completed_jobs` counter for 30 minutes
4. Verify affected schedules reach `COMPLETED` status

## Communication template

> We are investigating an issue affecting [provider] publishing. [Publishing has been temporarily paused / Individual posts may be delayed]. We will update you within [timeframe]. No action is required from you at this time. [OR: Please reconnect your {provider} account in Settings → Social Connections.]

## Post-incident

1. Document timeline in incident ticket
2. Update runbooks if new failure mode discovered
3. Add test coverage for regression if applicable
4. Review whether kill switch activation was appropriate

## Related

- `docs/INCIDENT_RESPONSE.md`
- `docs/STAGE_2_ROLLBACK.md`
- `docs/SOCIAL_PROVIDER_RUNBOOK.md`
