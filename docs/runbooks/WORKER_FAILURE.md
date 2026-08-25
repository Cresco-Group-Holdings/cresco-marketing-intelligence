# Runbook — Worker / Queue Failure

## Detect
- Operations dashboard shows worker unhealthy
- Queue backlog growing
- Cron invocations failing (401/403 or 5xx)

## Verify
1. `WORKER_TOKEN` / `CRON_SECRET` configured in production
2. Worker routes reachable: `/api/workers/process` (Bearer auth)
3. Check job table for stuck `RUNNING` jobs

## Recover
1. Restart worker process / re-trigger cron
2. Run recovery endpoint if available: `/api/workers/recover`
3. Monitor queue drain

## Prevent
- Ensure scheduler secrets rotated on compromise
- Alert on queue depth threshold (see operations dashboard)
