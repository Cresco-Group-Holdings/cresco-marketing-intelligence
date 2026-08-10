# Publishing scheduler

Production publishing uses **Vercel Cron** on the Hobby plan via a single daily dispatcher. High-frequency schedules remain available through worker-token endpoints or Vercel Pro cron entries.

## Schedule

| Setting | Hobby (default) | Pro / external |
|---------|-----------------|----------------|
| Frequency | Once daily at **06:00 UTC** (`0 6 * * *`) | Every **5 minutes** (`*/5 * * * *`) on the publishing endpoint |
| Platform | Vercel Cron (`vercel.json`) | Vercel Pro cron, GitHub Actions, or any HTTPS scheduler |
| HTTP method | `GET` | `GET` or `POST` |
| Endpoint | `/api/cron/daily` | `/api/publishing-scheduler/process-due` |

The daily dispatcher enqueues due `ContentSchedule` rows, drains publishing jobs, processes digital asset jobs, and runs other platform maintenance schedulers in one authenticated pass. Individual `process-due` endpoints remain available for higher-frequency external scheduling.

## Authentication

| Caller | Header | Secret env var |
|--------|--------|----------------|
| **Vercel Cron (production)** | `Authorization: Bearer <CRON_SECRET>` | `CRON_SECRET` — set in Vercel project settings; Vercel injects this automatically on cron requests |
| **Manual / emergency ops** | `Authorization: Bearer <token>` | `PUBLISHING_WORKER_TOKEN` |

Requests without a valid bearer token receive **403**. When neither secret is configured, all scheduler requests are rejected.

No provider OAuth tokens or tenant credentials are exposed to the scheduler caller. Worker logic resolves tenant scope from database records only.

## Vercel setup

1. Generate a strong `CRON_SECRET` (32+ random bytes).
2. Add `CRON_SECRET` to Vercel **Production** (and Preview if cron should run there).
3. Ensure `PUBLISHING_WORKER_TOKEN` is set for manual fallback invocations.
4. Deploy — `vercel.json` registers the cron job on deploy.

## Local / manual testing

```bash
# Worker token (same as production manual ops)
curl -sS -X POST "http://localhost:3000/api/publishing-scheduler/process-due" \
  -H "Authorization: Bearer $PUBLISHING_WORKER_TOKEN" \
  -H "Content-Type: application/json"

# Optional batch limit
curl -sS -X POST "http://localhost:3000/api/publishing-scheduler/process-due?limit=5" \
  -H "Authorization: Bearer $PUBLISHING_WORKER_TOKEN"

# Simulate Vercel Cron (GET + CRON_SECRET)
curl -sS "http://localhost:3000/api/publishing-scheduler/process-due" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or use the helper script:

```bash
APP_URL=http://localhost:3000 PUBLISHING_WORKER_TOKEN=your-token node scripts/run-publishing-scheduler.mjs
```

## Failure and retry behaviour

- **HTTP non-2xx:** Vercel Cron retries according to platform policy; check Vercel deployment logs.
- **Scheduler disabled:** Set `PUBLISHING_SCHEDULER_ENABLED=false` — endpoint returns success with zero enqueues; jobs are not created.
- **Emergency shutdown:** `PUBLISHING_EMERGENCY_SHUTDOWN=true` disables scheduler and publishing paths.
- **Duplicate protection:** Re-running the scheduler does not create duplicate jobs for the same schedule (idempotency key on `PublishingJob`).
- **Partial drain:** `PUBLISHING_WORKER_BATCH` (default 10) limits jobs processed per run; the next cron pass continues.

## Disable safely

| Goal | Action |
|------|--------|
| Stop cron only | Remove cron from `vercel.json` and redeploy, **or** set `PUBLISHING_SCHEDULER_ENABLED=false` |
| Stop all publishing | `PUBLISHING_EMERGENCY_SHUTDOWN=true` |
| Revoke cron access | Rotate `CRON_SECRET` in Vercel |
| Revoke manual access | Rotate `PUBLISHING_WORKER_TOKEN` |

## GitHub Actions

`.github/workflows/publishing-scheduler.yml` is **manual emergency fallback only**. Do not add a `schedule` trigger — it consumes GitHub Actions minutes (~2,880 runs/month at 5-minute intervals).

## Related configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `PUBLISHING_SCHEDULER_ENABLED` | `true` | Master switch for enqueue path |
| `PUBLISHING_SCHEDULER_BATCH` | `50` | Max schedules considered per run |
| `PUBLISHING_WORKER_BATCH` | `10` | Max jobs drained per run |
| `PUBLISHING_EMERGENCY_SHUTDOWN` | `false` | Kill switch |

See also `docs/PUBLISHING_INCIDENT_RUNBOOK.md`.
