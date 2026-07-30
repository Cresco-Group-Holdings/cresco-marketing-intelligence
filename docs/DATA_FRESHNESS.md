# Data Freshness

Freshness measures how current warehouse data is relative to operational expectations. Task 3.1 provides health records and lag metrics; automated alerting is deferred to Task 3.2.

## Health model

`MarketingDataSourceHealth` stores point-in-time health snapshots per `MarketingDataSourceAccount`:

| Field | Purpose |
| --- | --- |
| `status` | `HEALTHY`, `DEGRADED`, `UNHEALTHY`, `UNKNOWN` |
| `freshnessLagMinutes` | Minutes since last successful data arrival |
| `lastSuccessfulSyncAt` | Timestamp of last completed ingest |
| `lastCheckedAt` | When this snapshot was recorded |
| `errorMessage` | Last failure reason (safe, no secrets) |
| `metadata` | Additional context (batch ID, record counts) |

Health records are append-only snapshots (new row per check), not upserted. Latest record per account is used for dashboard display.

## Status determination

| Status | Condition |
| --- | --- |
| `HEALTHY` | `freshnessLagMinutes` within SLA threshold |
| `DEGRADED` | Lag exceeds warning threshold but within critical threshold |
| `UNHEALTHY` | Lag exceeds critical threshold, or last batch `FAILED` |
| `UNKNOWN` | No ingest history (new account, or never synced) |

Default SLA thresholds (configurable per brand in 3.2):

| Source type | Warning (degraded) | Critical (unhealthy) |
| --- | --- | --- |
| `MANUAL_IMPORT` | N/A — event-driven | N/A |
| `SOCIAL_BRIDGE` | 12 hours | 24 hours |
| `FIRST_PARTY` | 1 hour | 6 hours |
| Connector sources (future) | 6 hours | 24 hours |

Manual import accounts report `HEALTHY` after successful import completion; lag is not monitored between imports in 3.1.

## Lag calculation

```
freshnessLagMinutes = floor((now - lastSuccessfulSyncAt) / 60_000)
```

For `MANUAL_IMPORT`:

- `lastSuccessfulSyncAt` = `ManualImportJob.completedAt` of most recent `COMPLETED` job
- If no completed import: `UNKNOWN`

For `SOCIAL_BRIDGE`:

- `lastSuccessfulSyncAt` = latest `SocialAnalyticsSync.completedAt` for linked social accounts (read from Stage 2 tables, not warehouse batches)
- Bridge health reflects social sync freshness, not warehouse ETL lag

For future connector sources:

- `lastSuccessfulSyncAt` = `RawMarketingBatch.completedAt` of most recent `COMPLETED` batch

## Account-level sync metadata

`MarketingDataSourceAccount` also stores:

- `lastSyncAt` — denormalised latest sync timestamp
- `lastSyncStatus` — `RawMarketingBatchStatus` of latest batch

Updated on batch completion for ingest paths that use `RawMarketingBatch`.

## Health check API

Brand-scoped endpoint (Task 3.1):

```
GET /api/brands/[brandId]/marketing-data/health
```

Returns per-account health summary:

```json
{
  "accounts": [
    {
      "accountId": "...",
      "provider": "MANUAL_IMPORT",
      "status": "HEALTHY",
      "freshnessLagMinutes": null,
      "lastSuccessfulSyncAt": "2026-07-29T14:30:00.000Z"
    },
    {
      "accountId": "...",
      "provider": "SOCIAL_BRIDGE",
      "status": "DEGRADED",
      "freshnessLagMinutes": 780,
      "lastSuccessfulSyncAt": "2026-07-29T01:30:00.000Z"
    }
  ]
}
```

Permission: `marketingData.read`.

## Data quality integration

`FRESHNESS` data quality rules (see `docs/DATA_QUALITY.md`) raise `DataQualityIssue` records when SLA is breached. Health API is operational; quality issues are analytical/alerting.

## What's deferred to 3.2

| Capability | Status |
| --- | --- |
| Freshness notification emails | Not implemented |
| Slack/webhook alerts | Not implemented |
| Per-metric freshness (observation-level lag) | Not implemented |
| Warehouse scheduler driving health checks | Cron deferred |
| Brand-configurable SLA UI | Schema ready; UI deferred |

Stage 2 notification framework (separate branch) will integrate in 3.2.

## Worker health check

A worker endpoint (authenticated via `PUBLISHING_WORKER_TOKEN` or dedicated warehouse worker token) refreshes health snapshots:

```
POST /api/marketing-data/health/check
```

Processes all active `MarketingDataSourceAccount` rows for eligible brands. Not scheduled in 3.1 — invoked manually or via future cron.

## Observability

Health check runs emit structured logs:

| Log message | Context |
| --- | --- |
| `warehouse.health.checked` | `accountId`, `status`, `freshnessLagMinutes` |
| `warehouse.health.degraded` | Account exceeded warning threshold |
| `warehouse.health.unhealthy` | Account exceeded critical threshold |

Counters follow the pattern in `docs/SOCIAL_ANALYTICS.md` observability section.

## Related documentation

- `docs/DATA_QUALITY.md` — freshness quality rules
- `docs/WAREHOUSE_OPERATIONS.md` — operations dashboard
- `docs/MARKETING_DATA_WAREHOUSE.md` — architecture overview
- `docs/SOCIAL_ANALYTICS.md` — social sync scheduler (feeds bridge freshness)
