# Data Lineage

Lineage tracks how warehouse entities derive from raw ingest through transformation to queryable facts. Every metric observation, dimension, and event should be traceable to its source batch and raw record.

## Purpose

- **Auditability** — operators can answer "where did this number come from?"
- **Reprocessing** — identify affected entities when a batch is re-run
- **Quality resolution** — link issues to source records for correction or suppression
- **Compliance** — demonstrate data provenance for reporting

## Core models

| Model | Purpose |
| --- | --- |
| `DataLineageRecord` | Directed edge in the provenance graph |
| `DataTransformationVersion` | Named, versioned transformation definition |
| `DataTransformationRun` | Execution of a transformation against a batch |

## Entity types

`DataLineageEntityType`:

| Type | Example entity |
| --- | --- |
| `RAW_RECORD` | `RawMarketingRecord.id` |
| `BATCH` | `RawMarketingBatch.id` |
| `DIMENSION` | `MarketingCampaign.id`, `MarketingChannel.id` |
| `METRIC` | `MarketingMetricObservation.id` |
| `EVENT` | `MarketingEvent.id` |
| `AGGREGATE` | `DailyMarketingAggregate.id` |
| `TRANSFORMATION` | `DataTransformationRun.id` |

## Lineage graph

```
RawMarketingBatch
    │
    ├── RawMarketingRecord  (RAW_RECORD)
    │         │
    │         ▼
    │   DataTransformationRun  (TRANSFORMATION)
    │         │
    │         ├── MarketingChannel / Campaign / …  (DIMENSION)
    │         ├── MarketingMetricObservation  (METRIC)
    │         └── MarketingEvent  (EVENT)
    │                   │
    │                   ▼
    │             DailyMarketingAggregate  (AGGREGATE)
    │
    └── DataQualityCheck → DataQualityIssue
```

Each `DataLineageRecord` stores:

- `entityType` + `entityId` — child entity
- `parentEntityType` + `parentEntityId` — parent entity (optional)
- `rawMarketingRecordId` — direct link to source raw record when applicable
- `transformationVersionId` — transformation that produced the entity
- `recordedAt` — when lineage was captured
- `metadata` — optional context (mapping version, rule ID, etc.)

## Transformation versions

`DataTransformationVersion` defines reusable transformation logic:

| Field | Purpose |
| --- | --- |
| `name` | Logical name (e.g. `manual-import-normaliser`, `social-bridge-v1`) |
| `version` | Semantic version string |
| `definition` | JSON transformation spec |
| `isActive` | Whether new runs use this version |

Unique constraint: `[name, version]`.

The stub normaliser in 3.1 registers `manual-import-normaliser@1.0.0` and `stub-provider-normaliser@1.0.0`. Live GA4/Ads transformation versions are placeholders only.

## Transformation runs

`DataTransformationRun` tracks per-batch execution:

| Field | Purpose |
| --- | --- |
| `rawMarketingBatchId` | Source batch |
| `transformationVersionId` | Applied version |
| `status` | `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| `recordsIn` / `recordsOut` / `recordsFailed` | Counters |
| `idempotencyKey` | Prevents duplicate runs |

Runs are created automatically when a batch transitions to transformation phase.

## Lineage capture points

| Stage | Lineage recorded |
| --- | --- |
| Raw ingest | `RAW_RECORD` ← `BATCH` |
| Normalisation | `DIMENSION` / `METRIC` / `EVENT` ← `RAW_RECORD` |
| Aggregate refresh | `AGGREGATE` ← `METRIC` (many-to-one) |
| Manual correction | `METRIC` (correction) ← original `METRIC` |
| Social bridge | `METRIC` ← implicit `SOCIAL` source (metadata only in 3.1) |

## Social bridge lineage

Social bridge observations in 3.1 record lineage metadata without a `RawMarketingRecord`:

```json
{
  "bridgeSource": "SOCIAL",
  "socialMetricId": "<SocialPostMetric.id>",
  "socialSnapshotKey": "<idempotency key>",
  "bridgeVersion": "social-bridge-v1"
}
```

Full `RawMarketingRecord` lineage for social data is deferred to Task 3.2 when social ETL writes through the warehouse ingest path.

## Reprocessing

When a batch is reprocessed (`syncType = REPROCESS`):

1. Existing lineage records for the batch are retained (append-only)
2. New transformation run created with new `idempotencyKey`
3. Superseded observations are identified by `idempotencyKey` collision — upsert replaces fact, lineage adds new edge
4. `DataQualityIssue` may be auto-resolved with action `REPROCESSED`

## Query patterns

Brand-scoped lineage APIs support:

- **Upstream** — given a metric ID, list raw records and batches
- **Downstream** — given a batch ID, list all produced dimensions, metrics, events, aggregates
- **Impact analysis** — given a transformation version, list affected entities since effective date

Raw payload content requires `marketingData.viewRaw` and is not included in standard lineage responses.

## Retention

Lineage records are append-only and retained with the parent entity lifecycle. Archiving a brand does not delete lineage history.

## Related documentation

- `docs/MARKETING_DATA_WAREHOUSE.md` — ingestion layers
- `docs/DATA_QUALITY.md` — quality checks linked to batches
- `docs/WAREHOUSE_OPERATIONS.md` — reprocess workflow
- `docs/MANUAL_IMPORT.md` — import lineage
