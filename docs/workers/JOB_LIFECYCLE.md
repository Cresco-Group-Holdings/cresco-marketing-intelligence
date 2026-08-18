# Worker Job Lifecycle

## States

| Status | Meaning |
|--------|---------|
| `PENDING` | Created, not yet schedulable |
| `SCHEDULED` | Future work (`dueAt` / `scheduledAt` in the future) |
| `READY` | Executable — waiting for a worker |
| `CLAIMED` | Reserved by a worker (transitional) |
| `RUNNING` | Handler executing under lease |
| `RETRY_WAIT` | Failed retryably; waiting for `nextRetryAt` |
| `SUCCEEDED` | Terminal success |
| `FAILED` | Terminal failure (may still move to dead letter) |
| `DEAD_LETTER` | Exhausted retry budget |
| `CANCELLED` | Cancelled before completion |

## Transitions

All transitions are validated in `src/lib/workers/lifecycle.ts` via `assertWorkerJobTransition`.

Typical happy path:

```
PENDING/SCHEDULED → READY → RUNNING → SUCCEEDED
```

Retry path:

```
RUNNING → RETRY_WAIT → READY → RUNNING → …
```

Lease recovery:

```
RUNNING (expired lease) → RETRY_WAIT → READY
```

Dead letter:

```
RUNNING/RETRY_WAIT (attemptCount >= maxAttempts) → DEAD_LETTER
```

## Idempotency

Every job has a unique `idempotencyKey`. Repeated dispatcher runs must not create duplicate rows.

## Tenant safety

`organisationId` is required on every job. Handlers re-validate domain references against the job's organisation before executing.
