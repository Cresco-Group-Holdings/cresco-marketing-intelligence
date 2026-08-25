# Task 6 — Background Operations Architecture

## Deployment model

| Component | Production execution |
|-----------|---------------------|
| Vercel Cron | Daily `/api/cron/daily-dispatch` (Hobby: once/day) |
| GitHub Actions | `worker-platform-scheduler.yml` every 6h — dispatch + process |
| Manual / external | `/api/workers/dispatch`, `/api/workers/process` with `WORKER_TOKEN` |
| Queue | Postgres `WorkerJob` (canonical) — not in-memory |

## Job contract (`WorkerJob`)

- Tenant scope: `organisationId` (trusted from persisted row, never from caller input)
- Identity: `idempotencyKey` unique per logical operation
- Lifecycle: `PENDING` → `SCHEDULED`/`READY` → `CLAIMED`/`RUNNING` → `SUCCEEDED` | `RETRY_WAIT` | `FAILED` | `DEAD_LETTER` | `CANCELLED`
- Concurrency: `claimDueJobs` with `SKIP LOCKED`
- Retry: exponential backoff via `lib/workers/backoff.ts`

## Task 6 additions

1. **Automation schedule evaluation** — `automationScheduleService.dispatchDueSchedules`
2. **Automation worker handler** — resumes `PENDING`/`FAILED` `AutomationExecution` rows
3. **Launch templates** — 7 templates in `lib/automation-engine/launch-templates.ts`
4. **`/automations` workspace** — Active / Templates / History / Errors
5. **Operations jobs API** — `/api/operations/jobs` with health metrics + manual retry
6. **Daily cron fan-out** — publishing, worker_dispatch, automation, intelligence
7. **Background intelligence** — stale provider detection, worker health monitoring
8. **Timezone scheduling** — `lib/background/scheduling.ts` with DST tests

## Missed execution policy

| Job type | Policy |
|----------|--------|
| Publishing | Execute within 15-minute grace window |
| Provider/analytics sync | Execute on worker recovery (up to 7 days) |
| Weekly report | Execute on recovery if still useful |

## Security

- Cron: `CRON_SECRET` (Vercel)
- Workers: `WORKER_TOKEN` / `PUBLISHING_WORKER_TOKEN`
- Tenant isolation: all handlers verify `organisationId` on domain rows
