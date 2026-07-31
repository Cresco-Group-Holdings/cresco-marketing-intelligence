# Warehouse Operations

Operational runbook for the Task 3.1 marketing data warehouse: batch processing, workers, health checks, reprocessing, and the operations UI.

## Operational surfaces

| Surface | Purpose |
| --- | --- |
| Operations dashboard | `/analytics/marketing-data` (feature-flagged) |
| Health API | Per-source freshness and status |
| Batch monitor | `RawMarketingBatch` lifecycle view |
| Manual import | Upload and mapping workflow |
| Quality inbox | Open `DataQualityIssue` resolution |

## Batch lifecycle

`RawMarketingBatch` status flow:

```
QUEUED → RUNNING → COMPLETED
                 → PARTIAL (retry scheduled)
                 → FAILED (terminal or max attempts)
                 → CANCELLED (operator)
```

### Sync types

| Type | Trigger |
| --- | --- |
| `MANUAL` | Operator or API request |
| `SCHEDULED` | Future cron (3.2+) |
| `BACKFILL` | Historical date range request |
| `WEBHOOK` | Incoming webhook (future) |
| `REPROCESS` | Re-run normalisation on existing raw records |

### Worker claiming

Follows `SocialAnalyticsSync` lease pattern (`docs/SOCIAL_ANALYTICS.md`):

1. Worker claims batch via compare-and-swap `updateMany` on `status = QUEUED`
2. Sets `workerId`, `leaseExpiresAt = now + MARKETING_WAREHOUSE_LEASE_SECONDS`
3. Extends lease via `heartbeatAt` during processing
4. Stale `RUNNING` batches (expired lease) reclaimed on next worker pass

### Retry

- Transient failures: `PARTIAL`, `nextRetryAt = now + backoff`, `attemptCount++`
- Terminal: `attemptCount >= maxAttempts` (default 3) → `FAILED`
- `lastError` stores safe message (no secrets, no raw payloads)

## Worker endpoints

Authenticated via `src/lib/api/worker-auth.ts` (bearer token).

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/marketing-data/batches/process-due` | POST | Claim and process due batches |
| `/api/marketing-data/aggregates/refresh` | POST | Run `AggregateRefreshRun` |
| `/api/marketing-data/health/check` | POST | Refresh health snapshots |

Worker token: `MARKETING_WAREHOUSE_WORKER_TOKEN` (falls back to `PUBLISHING_WORKER_TOKEN` in dev).

### Processing flow

```
process-due worker
  │
  ├─ Select QUEUED batches (and stale RUNNING)
  ├─ Claim batch (lease)
  ├─ For each RawMarketingRecord in batch:
  │     ├─ Validate schema version
  │     ├─ Run stub normaliser
  │     └─ Write lineage records
  ├─ Run data quality checks
  ├─ Enqueue aggregate refresh (if recordsOut > 0)
  └─ Complete batch (update account lastSyncAt)
```

`MARKETING_WAREHOUSE_MAX_BATCH_SIZE` limits records per pass (default 1000).

## Manual operations

Brand-scoped API routes under `/api/brands/[brandId]/marketing-data/`:

| Route | Permission | Purpose |
| --- | --- | --- |
| `GET /sources` | `marketingData.read` | List source accounts |
| `GET /health` | `marketingData.read` | Health summary |
| `GET /batches` | `marketingData.read` | Batch history |
| `POST /batches` | `marketingData.sync` | Trigger manual batch |
| `POST /batches/[id]/reprocess` | `marketingData.sync` | Reprocess batch |
| `POST /batches/[id]/cancel` | `marketingData.sync` | Cancel queued/running batch |
| `GET /quality/issues` | `marketingData.read` | Open quality issues |
| `POST /quality/issues/[id]/resolve` | `marketingData.manage` | Resolve issue |
| `GET /lineage/[entityType]/[entityId]` | `marketingData.read` | Lineage traversal |
| `GET /raw/[recordId]` | `marketingData.viewRaw` | Raw payload (restricted) |

## Aggregate refresh

`AggregateRefreshRun` recomputes `DailyMarketingAggregate` for a date range:

1. Triggered after batch completion or manually
2. Groups observations by `[metricKey, aggregateDate, dimensionKey, dimensionValue]`
3. Applies aggregation rule from `MarketingMetricDefinition`
4. Upserts aggregate rows (idempotent by unique constraint)

Daily grain only in 3.1.

## Audit events

Warehouse operations emit `recordAuditEvent()` entries:

| Action | Trigger |
| --- | --- |
| `marketingData.batch.started` | Manual batch created |
| `marketingData.batch.completed` | Batch terminal success |
| `marketingData.batch.failed` | Batch terminal failure |
| `marketingData.batch.reprocessed` | Reprocess requested |
| `marketingData.import.started` | Manual import uploaded |
| `marketingData.import.completed` | Import finished |
| `marketingData.quality.resolved` | Issue resolution |
| `marketingData.currencyRate.created` | Manual FX rate added |

## Feature flag

All warehouse routes and UI check `MARKETING_WAREHOUSE_ENABLED`. When disabled:

- API returns `404` or `503` with safe message
- Operations dashboard shows disabled state
- Worker endpoints reject requests

## Scheduler (deferred)

Automated batch scheduling (connector sync, social bridge ETL cron) is **not wired in 3.1**. The GitHub Actions pattern from `docs/SOCIAL_ANALYTICS.md` will be replicated in 3.2:

```
.github/workflows/marketing-warehouse-scheduler.yml  (future)
  → POST /api/marketing-data/batches/schedule
```

## Observability

Structured log messages:

| Message | Meaning |
| --- | --- |
| `warehouse.batch.claimed` | Worker claimed batch |
| `warehouse.batch.completed` | Batch finished successfully |
| `warehouse.batch.partial` | Batch partial; retry scheduled |
| `warehouse.batch.failed` | Batch terminal failure |
| `warehouse.batch.stale_reclaimed` | Expired lease reclaimed |
| `warehouse.normaliser.record_processed` | Record normalised |
| `warehouse.normaliser.record_rejected` | Record rejected (stub/provider inactive) |
| `warehouse.aggregate.refreshed` | Daily aggregates updated |
| `warehouse.quality.check_completed` | Quality check finished |

## Failure runbook

| Symptom | Action |
| --- | --- |
| Batch stuck `RUNNING` | Wait for lease expiry; worker reclaims automatically |
| Batch `FAILED` terminal | Check `lastError`; fix source data; reprocess |
| Health `UNHEALTHY` | Check linked social sync or last import; trigger manual sync |
| Open `CRITICAL` quality issues | Resolve via quality inbox or reprocess batch |
| Missing aggregates | Trigger manual `AggregateRefreshRun` |
| Import stuck `VALIDATING` | Review validation errors; fix mapping; retry |

## Local development

See `docs/DEVELOPMENT.md` warehouse section. Batches process inline when `MARKETING_WAREHOUSE_INLINE_PROCESSING=true` (dev/test only).

## Related documentation

- `docs/MARKETING_DATA_WAREHOUSE.md` — architecture
- `docs/DATA_FRESHNESS.md` — health checks
- `docs/DATA_QUALITY.md` — quality resolution
- `docs/DATA_LINEAGE.md` — reprocess lineage
- `docs/MANUAL_IMPORT.md` — import workflow
- `docs/TASK_3_1_SECURITY_REVIEW.md` — security controls
