# Retry and Dead Letter

## Error categories

| Category | Worker behaviour |
|----------|------------------|
| `RETRYABLE` | Schedule `RETRY_WAIT` with exponential backoff + jitter |
| `RATE_LIMITED` | Respect `retryAfterMs` / provider delay |
| `REAUTH_REQUIRED` | Terminal for job; domain service persists reauth state |
| `NON_RETRYABLE` | Fail or dead-letter without retry |
| `CONFIGURATION_ERROR` | Terminal — fix configuration before retry |

Classification is centralized in the worker executor. Feature handlers return structured outcomes; they must not implement independent recursive retry loops.

## Backoff

Configured in `src/lib/workers/config.ts`:

- `WORKER_RETRY_BASE_DELAY_MS` (default 5s)
- `WORKER_RETRY_MAX_DELAY_MS` (default 5m)
- `WORKER_RETRY_JITTER_FACTOR` (default 0.2)

Tests inject a deterministic clock via `setClockForTests`.

## Dead letter

When `attemptCount >= maxAttempts`, jobs transition to `DEAD_LETTER` with:

- `errorCategory`
- `safeErrorMessage` (no secrets)
- `failedAt`
- domain reference preserved on the job row

Failed work is never silently dropped.

## Publishing ambiguity

Publishing handlers delegate to `processPublicationPublishingJob`, which uses advisory locks and publication idempotency. Lease recovery may requeue work; the domain handler skips already-completed jobs.
