# Task 6 — Background Operations Architecture

## Deployment model (Task 6.1 launch, updated Task 7)

| Component | Production execution |
|-----------|---------------------|
| **Vercel Cron (PRIMARY)** | `/api/cron/worker-cycle` every **5 minutes** (Pro) — recover, dispatch, automation, process, publishing |
| **GitHub Actions (FALLBACK)** | `worker-platform-scheduler.yml` every **30 minutes** — `/api/workers/fallback-cycle` when primary heartbeat stale |
| Vercel Cron (daily) | `/api/cron/daily-dispatch` (Hobby: once/day fan-out) |
| Manual / external | `/api/workers/dispatch`, `/api/workers/process`, `/api/workers/automation-schedules` with `WORKER_TOKEN` |
| Queue | Postgres `WorkerJob` (canonical) — not in-memory |

### Scheduling SLA

- **Configured trigger:** every 5 minutes via Vercel Pro cron.
- **Publication dispatch target:** within **10 minutes** of requested `dueAt` under normal conditions.
- **Customer wording:** typically within about 10 minutes — not exact-second publishing.
- **Fallback:** GitHub Actions runs only when primary heartbeat is stale (≥10 min lag).

### Scheduler health

- `SchedulerHeartbeat` table records last dispatcher/process invocation.
- `/api/operations/jobs` exposes scheduler lag and missed-heartbeat state.
- Missed heartbeat (>15 min) creates operational alert: *Background scheduler has not executed for 15 minutes.*

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

## Marketing journey WAITING resumer — launch scope

**Excluded from launch and hidden.** CRM marketing journeys (`/automation`) are not in primary navigation; launch automations use the automation engine (`/automations`). Delay nodes persist `resumeAt` metadata but have no background resumer — **POST-LAUNCH** work item.
