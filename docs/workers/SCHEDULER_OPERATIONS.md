# Scheduler Operations

## Triggers

| Trigger | Endpoint | Auth |
|---------|----------|------|
| Vercel daily cron | `GET/POST /api/cron/daily-dispatch` | `CRON_SECRET` |
| Canonical dispatch | `GET/POST /api/workers/dispatch` | `CRON_SECRET` or `WORKER_TOKEN` |
| Canonical process | `GET/POST /api/workers/process` | `WORKER_TOKEN` |
| Lease recovery | `GET/POST /api/workers/recover` | `CRON_SECRET` or `WORKER_TOKEN` |
| Legacy publishing | `GET/POST /api/publishing-scheduler/process-due` | dispatches + processes + legacy pass |

## GitHub Actions

Workflow: `.github/workflows/worker-platform-scheduler.yml`

Required production secrets:

- `APP_URL`
- `WORKER_TOKEN` (or `PUBLISHING_WORKER_TOKEN`)

Never store provider credentials in scheduler workflows.

## Recommended invocation pattern

1. `POST /api/workers/dispatch?limit=25`
2. `POST /api/workers/process?limit=25`
3. Optionally `POST /api/workers/recover` if long-running jobs are common

## Timing precision

Vercel Hobby allows at most one cron per day. Sub-hour precision requires GitHub Actions, Vercel Pro, or an external scheduler calling the worker API.

All timestamps are stored in UTC. Customer timezones are applied only at product boundaries (scheduling UI, digest windows).

## No-work success

Dispatch and process endpoints return HTTP 200 when there is simply no due work. Failures indicate auth, infrastructure, or handler errors.
