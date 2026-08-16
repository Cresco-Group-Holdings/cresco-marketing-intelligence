# Worker Platform Runbook

## Health checks

1. Confirm `WORKER_TOKEN` (or `PUBLISHING_WORKER_TOKEN`) is set in production.
2. `POST /api/workers/dispatch` with Bearer token → expect 200 and dispatch summary.
3. `POST /api/workers/process` → expect 200 and process summary.

## Stuck jobs

1. Query `WorkerJob` where `status = 'RUNNING'` and `leaseExpiresAt < now()`.
2. Run `POST /api/workers/recover`.
3. Verify jobs moved to `RETRY_WAIT` or `DEAD_LETTER`.

## Dead letter inspection

```sql
SELECT id, "jobType", "organisationId", "domainRefType", "domainRefId",
       "attemptCount", "errorCategory", "safeErrorMessage", "failedAt"
FROM "WorkerJob"
WHERE status = 'DEAD_LETTER'
ORDER BY "failedAt" DESC
LIMIT 50;
```

## Manual retry (admin)

Re-dispatch by creating a new job with a fresh idempotency key suffix, or use admin tooling when available. Cancelling is supported for non-terminal jobs via `workerJobService.cancelJob`.

## Scheduler failure

| Symptom | Action |
|---------|--------|
| 403 on worker routes | Verify `WORKER_TOKEN` / `CRON_SECRET` |
| Jobs queued but not running | Invoke `/api/workers/process` |
| Duplicate external side effects | Check idempotency keys and domain handler guards |

## Logs

Search structured events:

- `worker.dispatch_completed`
- `worker.process_completed`
- `worker.lease_recoveries`
- `worker.job_failed`

Dimensions: `jobType`, `errorCategory`, `organisationId` (internal only).
