# Unified social analytics

Only observations returned by official provider APIs are persisted. Missing metrics remain unavailable and are never written as zero or substituted with a semantically different metric.

## Deterministic formulas

- Engagement rate: `(likes + reactions + comments + shares + saves) / impressions × 100`, only when impressions and at least one interaction metric exist.
- Click-through rate: `clicks / impressions × 100`, only when both fields exist and impressions are positive.
- Follower growth: latest compatible follower/subscriber count minus the earliest count in the range. Followers and subscribers are not combined.
- Average views per post: sum of available post view observations divided by posts that expose views.
- Publishing consistency: completed publishing occurrences divided by whole business-local days in the selected range.
- Video completion rate: completed-view count divided by compatible video-view count. It is omitted when the provider supplies only an average-view percentage.
- Cost per result is intentionally unavailable until real spend and compatible result observations are integrated.

Provider source fields, units, cumulative/periodic behavior, scope, aggregation rules, and limitations are defined in `src/lib/social/metric-registry.ts` and mirrored into `SocialMetricDefinition`.

Derived values are always computed from aggregated numerators and denominators. Post-level percentages are never averaged together, because that would weight a three-impression post equally with a thirty-thousand-impression post.

## Scheduler operation

The scheduler is a cron-driven pass that enqueues recurring work and then drains it.

1. `.github/workflows/social-analytics-scheduler.yml` runs every six hours and calls `scripts/run-social-analytics-scheduler.mjs`.
2. The script issues an authenticated `POST /api/social-analytics-sync/schedule` using `PUBLISHING_WORKER_TOKEN`.
3. `socialAnalyticsSchedulerService.enqueueDueAccounts()` creates at most one `SocialAnalyticsSync` per eligible account per schedule window.
4. `socialAnalyticsSyncService.processDue()` then claims and runs due work.

Any scheduler capable of an authenticated HTTPS request can replace the GitHub Actions workflow — a Vercel Cron job, a Kubernetes `CronJob`, or an external orchestrator all work against the same endpoint.

### Eligibility

An account is scheduled only when all of the following hold:

- the `SocialAccount` is `CONNECTED`;
- its `SocialConnection` is `CONNECTED` with no `reconnectRequiredAt`;
- the account exposes the `READ_INSIGHTS` capability;
- the brand is `ACTIVE` and not archived;
- the owning organisation is `ACTIVE` and not archived.

Organisation status is the entitlement gate. The schema has no separate billing or plan model yet, so suspending an organisation is the supported way to withdraw analytics entitlement; a future plan model should extend the same eligibility filter.

### Deduplication

Scheduled runs are bucketed into fixed windows of `SOCIAL_ANALYTICS_SYNC_INTERVAL_MINUTES`. The idempotency key is `scheduled:<socialAccountId>:<windowStartISO>`, and `SocialAnalyticsSync.idempotencyKey` is unique, so repeated scheduler invocations inside one window cannot create duplicate jobs.

Manual syncs use their own idempotency keys and coexist safely with scheduled syncs: duplicate observations are impossible because each entity write is anchored by a `SocialMetricSnapshot` idempotency key, and `SocialPostMetric` and `SocialAccountMetric` both carry natural unique constraints.

The first scheduled run for an account is enqueued as an `INITIAL` sync with a historical backfill window; subsequent runs are `SCHEDULED`.

## Retry, credential refresh, and reconnect

- Rate limits and transient provider failures mark the sync `PARTIAL`, persist the cursor, and set `nextRetryAt` to now plus `SOCIAL_ANALYTICS_SYNC_RETRY_SECONDS`.
- A `TOKEN_EXPIRED` response triggers exactly one refresh through the production credential adapter for that provider (Meta token exchange for Instagram and Facebook; standard refresh grants for LinkedIn, TikTok, YouTube, and X).
- On a successful refresh the new token is stored encrypted, `SocialConnection.tokenExpiresAt` and `lastRefreshAt` are updated, `refreshAttemptCount` is incremented, and the sync is requeued once with its cursor and already-stored observations intact.
- A second expiry, or a failed refresh, is terminal: the sync moves to `FAILED`, a terminal `SocialAnalyticsError` is recorded, and the connection is set to `REAUTH_REQUIRED` with `reconnectRequiredAt`. The scheduler then skips the account until an operator reconnects it.
- Providers that require a stored refresh token (LinkedIn, TikTok, YouTube, X) fail explicitly with a reconnect-required state when none is held, rather than retrying indefinitely.
- Retries are bounded by `maxAttempts` (default 3). Exhausting them fails the sync terminally.

## Stale job recovery

Each worker claims a sync with a compare-and-swap `updateMany` that pins the observed status, `workerId`, and `leaseExpiresAt`. Two workers racing on the same row cannot both win.

- A claim sets `status = RUNNING`, a `workerId`, `startedAt`, `heartbeatAt`, and `leaseExpiresAt = now + SOCIAL_ANALYTICS_SYNC_LEASE_SECONDS`.
- The lease and heartbeat are extended after every account fetch, discovery page, and post fetch.
- `processDue()` selects due `QUEUED`/`PARTIAL` syncs **and** `RUNNING` syncs whose lease has expired, so a killed worker's job is reclaimed on the next pass.
- A reclaim increments `recoveryCount` rather than `attemptCount`. Exceeding `maxRecoveries` (default 3) fails the sync terminally with a normalized error.
- Recovery resumes from the persisted cursor. Entities already snapshotted in that sync are skipped without a provider call, so completed work is never repeated and observations are never duplicated.

## Timezone semantics

- The reporting timezone resolves in order: an explicit request parameter, `Brand.analyticsTimezone`, `Organisation.defaultTimezone`, then `UTC`.
- Unsupported IANA identifiers are rejected with a validation error on the request path and ignored (falling through to the next source) when they come from stored settings.
- Requested boundaries are expanded to whole business-local days and converted to UTC before querying, with the zone offset sampled twice so daylight-saving transitions resolve to the correct instant.
- Daily, weekly, and monthly buckets are keyed by business-local calendar periods; weeks start on Monday.
- Publishing consistency divides by whole business-local days, so a 23-hour or 25-hour DST day still counts once.
- Raw provider timestamps are stored and exported in UTC. Only range boundaries and bucket keys use the business timezone.
- CSV exports carry a leading `# timezone=… from=… to=… scope=…` comment; JSON exports carry an equivalent `metadata` object.

## Historical backfill and provider limitations

Posts published through this platform are always covered through `ContentSchedule` and `PublishingJob`, and they retain full content attribution. Where a provider also exposes post history, the sync engine walks it for the configured window and merges the results. Platform attribution always wins over provider history for the same post ID, and overlapping IDs are deduplicated by the per-entity snapshot key.

| Provider | Provider history | Limitation |
| --- | --- | --- |
| Instagram | Supported (`/{ig-user}/media`) | Insight retention and metric availability vary by media type and account eligibility. |
| Facebook | Supported (`/{page}/posts`) | Several Page insight metrics are deprecated or restricted by Page category and API version. |
| LinkedIn | **Not supported** | No organisation post-history feed exists under standard Community Management permissions, so LinkedIn analytics covers posts published through this platform only. |
| TikTok | Supported (`/video/list/`) | The list endpoint is not date-filterable, so the window is applied client-side; private and deleted videos are not returned. |
| YouTube | Supported (`/search`) | Uses the public search index for the channel, so unlisted and private uploads are not returned. |
| X | Supported (`/users/:id/tweets`) | Bounded by the app's access tier; non-public and organic metrics require elevated entitlements. |

When a provider cannot supply history, the sync records `historicalBackfill:<PROVIDER>` in `unavailableMetrics` instead of implying coverage it does not have.

Backfill is paged: at most `SOCIAL_ANALYTICS_BACKFILL_MAX_PAGES` pages are walked per worker pass, the discovery cursor is persisted after every page, and the next pass resumes where the previous one stopped.

## Provider-specific unsupported metrics

- Reach is not available on X or YouTube; impressions and views are distinct metrics and are never substituted for it.
- LinkedIn's standard social-actions endpoint returns engagement summaries only, so LinkedIn impressions and reach are unavailable.
- Saves are Instagram-only and are further limited to eligible media.
- Subscribers are YouTube-only; followers are never merged with subscribers.
- Video completion rate is omitted when a provider returns only an average-view-percentage rather than a completed-view count.
- Cost per result and any spend-derived metric are unavailable until real advertising spend is integrated.

## Cursor persistence

`SocialAnalyticsSync.cursor` holds three independent provider cursors:

- `account` — account-insight pagination;
- `posts` — post-metric pagination;
- `discovery` — historical post-history pagination.

All three are written inside the sync loop, not only at completion, so an interrupted run resumes mid-range.

## Observability

Structured JSON logs are emitted through `src/lib/logging`, and in-process counters are exposed by `src/lib/analytics/observability.ts`:

| Counter | Meaning |
| --- | --- |
| `analytics.scheduled_jobs_enqueued` | Recurring syncs created by a scheduler pass. |
| `analytics.scheduled_jobs_skipped` | Accounts already scheduled for the current window. |
| `analytics.stale_jobs_reclaimed` | `RUNNING` syncs recovered after a worker interruption. |
| `analytics.refresh_attempts` / `analytics.refresh_succeeded` / `analytics.refresh_failed` | Credential refresh outcomes. |
| `analytics.reconnect_required` | Connections moved to `REAUTH_REQUIRED`. |
| `analytics.partial_syncs` / `analytics.completed_syncs` / `analytics.failed_syncs` | Terminal sync outcomes. |
| `analytics.rate_limits` | Provider rate-limit responses. |
| `analytics.unavailable_metrics` | Metrics a provider declined to return. |
| `analytics.terminal_provider_failures` | Non-recoverable provider errors. |
| `analytics.metrics_stored` / `analytics.posts_processed` | Throughput per sync. |
| `analytics.backfill_pages` | Provider history pages walked. |

Every counter increment also writes a structured log line with the counter name as the message, so an external collector can build the same series from logs alone. Log context is redacted by the shared logger before serialisation.

## Testing

- `npm run test:unit` and `npm run test:integration` run with mocked Prisma and mocked provider transport.
- `npm run test:database` runs the isolated real-database suite in `tests/database`. It requires `ANALYTICS_TEST_DATABASE_URL` to point at a disposable PostgreSQL database, applies the real migrations, and exercises real services, real route handlers, and real adapters with only the HTTP transport mocked. The suite is skipped when the variable is unset.
