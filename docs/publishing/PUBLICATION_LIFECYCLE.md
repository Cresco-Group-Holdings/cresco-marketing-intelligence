# Publication Lifecycle

## Status flow

```
DRAFT → PENDING_APPROVAL → APPROVED / SCHEDULED
APPROVED → QUEUED → PUBLISHING → PUBLISHED | FAILED
SCHEDULED → QUEUED (when due) → PUBLISHING → PUBLISHED
FAILED → QUEUED (retry)
* → CANCELLED (when allowed)
```

Transitions are validated in `publication-lifecycle.ts`.

## Post now

1. `canonicalPublicationService.publishNow()`
2. Creates `Publication` (idempotent via `idempotencyKey`)
3. Transitions to `QUEUED`
4. Creates `PublishingJob` with `publicationId`
5. Calls `processPublicationPublishingJob(jobId)`

## Schedule

1. `canonicalPublicationService.schedulePublication()`
2. Creates `Publication` with `status=SCHEDULED`
3. Projects to `CalendarEvent`
4. `publishingSchedulerService.enqueueDueScheduledPublications()` creates jobs when due

## Failure handling

| Category | Behavior |
|----------|----------|
| RETRYABLE | Requeue with backoff |
| NON_RETRYABLE | Terminal `FAILED` |
| REAUTH_REQUIRED | `FAILED` with `lastErrorCode=REAUTH_REQUIRED` |

## Cancel / reschedule

- Cancel: `SCHEDULED` → `CANCELLED`; cancels queued jobs
- Reschedule: updates `scheduledFor`; re-projects calendar
- Published content cannot be "cancelled" locally without explicit provider delete (not implemented)

## Idempotency

- Publication creation: unique `(organisationId, brandId, idempotencyKey)`
- PublishingJob: unique `(publicationId, idempotencyKey)`
- Provider adapter checks idempotency key to prevent duplicate posts
