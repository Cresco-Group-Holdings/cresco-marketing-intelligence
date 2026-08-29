# Runbook — Application Outage

## Detect
- Health check `/api/health` failing
- Error rate spike in logs
- User reports / status page

## Classify
- **P0:** Full app unavailable
- **P1:** Major module degraded

## Contain
1. Check recent deployments — consider rollback (see `RELEASE_CHECKLIST.md`)
2. Verify database connectivity (`/api/readiness`)
3. Check Supabase status

## Recover
1. Roll back application if bad deploy
2. Restart affected services
3. Run smoke tests: login, dashboard, analytics

## Document
Record timeline, root cause, and follow-up in incident log.
