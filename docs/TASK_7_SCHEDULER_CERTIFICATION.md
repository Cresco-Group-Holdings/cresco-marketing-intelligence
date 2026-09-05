# Task 7 — Scheduler Certification

## Scheduler ownership

| Role | Mechanism | Cadence | Endpoint |
|------|-----------|---------|----------|
| **PRIMARY** | Vercel Cron (Pro) | `*/5 * * * *` | `POST /api/cron/worker-cycle` |
| **FALLBACK** | GitHub Actions watchdog | `*/30 * * * *` | `POST /api/workers/fallback-cycle` (only when primary heartbeat stale) |
| **DAILY CATCH-UP** | Vercel Cron (Hobby-compatible) | `0 2 * * *` | `POST /api/cron/daily-dispatch` |

## Launch SLA

| Metric | Target |
|--------|--------|
| Configured scheduler trigger | Every 5 minutes (Vercel Pro cron) |
| Publication dispatch | Within **10 minutes** of `dueAt` under normal operating conditions |
| Measured cadence | Observed via `SchedulerHeartbeat.metadata.recentCycles` |

**Customer-facing wording:** Scheduled posts are processed automatically, typically within about 10 minutes of the requested time. Exact-second execution is not guaranteed.

## Canonical worker cycle

The thin cron route delegates to `workerCycleService.run()`:

1. `recoverExpiredJobs`
2. `dispatchDueJobs`
3. `dispatchDueSchedules` (automation)
4. `processAvailableJobs`
5. Legacy `publishingSchedulerService.runSchedulerPass` (errors recorded, not silently ignored)

## Heartbeat

`SchedulerHeartbeat` records every canonical cycle with:

- `source` (`vercel_cron`, `github_actions_fallback`, `daily_dispatch`, …)
- `cycleId`
- `startedAt` / `completedAt` / `durationMs`
- `recentCycles` history (last 24 entries in metadata)
- Missed heartbeat threshold: **15 minutes** → operational alert

## Fallback policy

GitHub Actions fallback runs only when:

- Primary heartbeat lag ≥ `LAUNCH_SCHEDULER_FALLBACK_STALE_MS` (10 minutes), or
- `workflow_dispatch` with `force=true`

When primary is healthy, fallback returns `skipped: true` with `skipReason: PRIMARY_HEALTHY`.

## Security

- Primary cron: `CRON_SECRET` bearer token only
- Fallback: `WORKER_TOKEN` / `PUBLISHING_WORKER_TOKEN` or `CRON_SECRET`
- No query-string authentication
- Fail closed when secrets unset
