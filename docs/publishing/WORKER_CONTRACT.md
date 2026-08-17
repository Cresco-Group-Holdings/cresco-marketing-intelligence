# Worker Contract

## Entry point

```typescript
processPublicationPublishingJob(jobId: string, context?: TenantContext)
```

## Responsibilities

1. Acquire PostgreSQL advisory transaction lock per job
2. Validate job has `publicationId` and is `QUEUED`/`PROCESSING`
3. Verify tenant scope when `context` provided
4. Obtain access token via `tokenLifecycleService.getValidAccessToken()`
5. Transition `Publication` → `PUBLISHING`
6. Create `PublicationAttempt` (RUNNING)
7. Execute via `providerGateway.execute()`
8. Persist `externalPublicationId`, permalink, status
9. Update `PublishingJob` → `COMPLETED` or requeue/fail
10. Project calendar event (best-effort)
11. Emit audit events
12. Send notification (best-effort — failure must not reverse publish success)

## Scheduler integration

`publishingSchedulerService.runSchedulerPass()`:

1. `enqueueDueSchedules()` — legacy ContentSchedule path
2. `canonicalPublicationService.enqueueDueScheduledPublications()` — canonical path
3. `processDue()` — drains all due `PublishingJob` records

`publishing-worker.processPublishingJob()` routes:

- `publicationId` set → `processPublicationPublishingJob`
- else → legacy provider services

## Task 3

Production scheduler/cron deployment is Task 3. Task 2 exposes the contract only.

## Concurrency

`QUEUED → PROCESSING` is atomic within advisory lock. Two workers cannot process the same job simultaneously.
