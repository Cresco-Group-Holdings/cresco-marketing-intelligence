# Publishing scheduler

Production publishing uses a **daily Vercel Cron dispatcher** on the Hobby plan, with the publishing job handler remaining available for manual ops and future high-frequency schedulers.

## Architecture

```
Vercel Cron (Hobby: once/day)
        ↓
/api/cron/daily-dispatch
        ↓
dailyCronDispatchService
        ↓
/api/publishing-scheduler/process-due  (internal job — publishing)
        ↓
PublishingJob queue + workers
```

Job implementation is separated from scheduling configuration in `src/lib/deployment/scheduling.ts`.

## Hobby deployment schedule

| Setting | Value |
|---------|--------|
| Vercel cron path | `/api/cron/daily-dispatch` |
| Vercel cron expression | `0 2 * * *` (once daily, 02:00 UTC) |
| Internal publishing target (Pro / external) | `*/5 * * * *` |

The daily dispatcher runs publishing in **bounded passes** (default max 8 passes, 50s total) so a single Vercel invocation cannot run unbounded work.

## Direct publishing endpoint

| Setting | Value |
|---------|--------|
| Endpoint | `/api/publishing-scheduler/process-due` |
| HTTP methods | `GET`, `POST` |
| Registered in `vercel.json` | **No** (manual / external scheduler only on Hobby) |

Each pass enqueues due `ContentSchedule` rows and drains the publishing job queue (idempotent per schedule via `scheduledJobIdempotencyKey`).

## Authentication

| Caller | Header | Secret env var |
|--------|--------|----------------|
| **Vercel Cron** | `Authorization: Bearer <CRON_SECRET>` | `CRON_SECRET` |
| **Manual / emergency ops** | `Authorization: Bearer <token>` | `PUBLISHING_WORKER_TOKEN` |

The daily dispatcher accepts **CRON_SECRET only**. The publishing endpoint accepts worker or cron secrets.

Requests without a valid bearer token receive **403**. Secrets are never logged or returned in responses.

## Environment safety

| Environment | Default behaviour |
|-------------|-------------------|
| Production | Daily cron runs when `CRON_SCHEDULER_ENABLED` is not `false` |
| Preview | Skipped unless `CRON_ALLOW_PREVIEW=true` |
| Development | Skipped unless `CRON_ALLOW_DEVELOPMENT=true` |

## Vercel setup

1. Generate a strong `CRON_SECRET` (32+ random bytes).
2. Add `CRON_SECRET` to Vercel **Production** environment variables.
3. Ensure `PUBLISHING_WORKER_TOKEN` is set for manual fallback invocations.
4. Deploy — `vercel.json` registers the daily cron on deploy.
5. CI/build runs `npm run validate:vercel-cron` to reject Hobby-incompatible schedules.

## Local / manual testing

```bash
# Daily dispatcher (same auth as Vercel Cron)
curl -sS "http://localhost:3000/api/cron/daily-dispatch" \
  -H "Authorization: Bearer $CRON_SECRET"

# Direct publishing pass (worker or cron secret)
curl -sS -X POST "http://localhost:3000/api/publishing-scheduler/process-due" \
  -H "Authorization: Bearer $PUBLISHING_WORKER_TOKEN"

# Optional batch limit
curl -sS -X POST "http://localhost:3000/api/publishing-scheduler/process-due?limit=5" \
  -H "Authorization: Bearer $PUBLISHING_WORKER_TOKEN"
```

Or use the helper script:

```bash
APP_URL=http://localhost:3000 PUBLISHING_WORKER_TOKEN=your-token node scripts/run-publishing-scheduler.mjs
```

## Failure and retry behaviour

- **HTTP non-2xx:** Vercel Cron retries according to platform policy; check Vercel deployment logs.
- **Scheduler disabled:** Set `PUBLISHING_SCHEDULER_ENABLED=false` — jobs are not created.
- **Emergency shutdown:** `PUBLISHING_EMERGENCY_SHUTDOWN=true` disables scheduler and publishing paths.
- **Duplicate protection:** Re-running does not create duplicate jobs for the same schedule.
- **Partial drain:** Configurable batches; the next daily pass or manual invocation continues.

## Disable safely

| Goal | Action |
|------|--------|
| Stop all scheduled jobs | Set `CRON_SCHEDULER_ENABLED=false` or remove crons from `vercel.json` |
| Stop publishing only | `PUBLISHING_SCHEDULER_ENABLED=false` |
| Stop all publishing | `PUBLISHING_EMERGENCY_SHUTDOWN=true` |
| Revoke cron access | Rotate `CRON_SECRET` in Vercel |

## GitHub Actions

`.github/workflows/publishing-scheduler.yml` is **manual emergency fallback only**. Do not add a `schedule` trigger for high-frequency runs on Hobby.

## Future: Vercel Pro or external scheduler

When upgrading from Hobby:

1. Set Vercel cron on `/api/publishing-scheduler/process-due` to `*/5 * * * *` **or**
2. Point an external scheduler (GitHub Actions, Cloud Scheduler, worker) at the publishing endpoint with `PUBLISHING_WORKER_TOKEN`.

Target schedules are documented in `PRODUCTION_TARGET_SCHEDULES` (`src/lib/deployment/scheduling.ts`).

## Related configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `CRON_SCHEDULER_ENABLED` | `true` | Master switch for daily dispatcher |
| `CRON_DAILY_MAX_PASSES_PER_JOB` | `8` | Max publishing passes per daily run |
| `CRON_DAILY_MAX_TOTAL_PASSES` | `12` | Max passes across all jobs |
| `CRON_DAILY_MAX_DURATION_MS` | `50000` | Wall-clock budget per daily run |
| `PUBLISHING_SCHEDULER_ENABLED` | `true` | Master switch for enqueue path |
| `PUBLISHING_SCHEDULER_BATCH` | `50` | Max schedules considered per pass |
| `PUBLISHING_WORKER_BATCH` | `10` | Max jobs drained per pass |
| `PUBLISHING_EMERGENCY_SHUTDOWN` | `false` | Kill switch |

See also `docs/PUBLISHING_INCIDENT_RUNBOOK.md`.
