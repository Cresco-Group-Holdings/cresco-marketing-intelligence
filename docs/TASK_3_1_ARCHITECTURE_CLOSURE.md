# Task 3.1 — Architecture Closure Assessment

Date: 2026-07-30  
Branch: `cursor/marketing-data-warehouse-e94c`

## Verdict

**Task 3.1 — Architecture Complete**

The warehouse foundation is internally consistent, transaction-safe per record, duplicate-safe via idempotency keys and upserts, tenant-scoped, extensible for Task 3.2 dimensions, and covered by unit, integration, and real-database tests. Live provider integrations remain intentionally deferred.

---

## 1. Metric registry

**Count: exactly 10 default metrics** (prior report incorrectly said 9).

| Key | Unit | Aggregation | Cumulative |
| --- | --- | --- | --- |
| sessions | count | SUM | no |
| users | count | SUM | no |
| pageviews | count | SUM | no |
| impressions | count | SUM | yes |
| clicks | count | SUM | yes |
| conversions | count | SUM | no |
| revenue | currency | SUM | no |
| cost | currency | SUM | no |
| ctr | percentage | AVG | no |
| engagement_rate | percentage | AVG | no |

Uniqueness: `@@unique([brandId, canonicalKey])` on `MarketingMetricDefinition`.

---

## 2. Import and batch limits

- `MARKETING_WAREHOUSE_MAX_IMPORT_ROWS` = 10,000
- `MARKETING_WAREHOUSE_MAX_BATCH_SIZE` = 5,000 per `ingestRecords` call
- `confirmImport` creates one batch, then calls `ingestRecordsInChunks`
- Boundary tests: `tests/unit/warehouse-chunking.test.ts`, `tests/database/marketing-warehouse-architecture-e2e.test.ts`

---

## 3. Transformation atomicity and recovery

- Each raw record normalises inside `prisma.$transaction` — dimension upsert, observation/event upsert, lineage create, and status update commit or roll back together
- `DataTransformationRun.idempotencyKey = normalise:{batchId}` — deterministic, restart-safe
- Completed runs short-circuit re-invocation; `RECEIVED`/`VALIDATED` records only are processed
- Failed records marked `REJECTED` without partial canonical writes in the same transaction

---

## 4. Idempotency

| Entity | Mechanism |
| --- | --- |
| Raw batch | `RawMarketingBatch.idempotencyKey` unique |
| Raw record | `@@unique([accountId, providerRecordId, recordType])` + checksum dedup + upsert |
| Dimensions | `upsert` on `brandId + provider + providerEntityId` |
| Observations | `upsert` on `idempotencyKey` |
| Events | `upsert` on `idempotencyKey` + `@@unique([brandId, provider, providerEventId])` |
| Lineage | `findFirst` on `(rawRecordId, entityType, entityId)` before create |
| Transformation run | `idempotencyKey = normalise:{batchId}` |
| Aggregate refresh | `AggregateRefreshRun.idempotencyKey` unique; completed runs return existing |
| Manual import | `ManualImportJob.idempotencyKey`; `COMPLETED` jobs cannot re-commit |

---

## 5. Tenant isolation

All services filter by `organisationId` and validate brand access via `brandService.getById`. Provider IDs are unique per `brandId`, so cross-tenant collision is impossible.

Database tests: `marketing-warehouse-architecture-e2e.test.ts` (cross-org, cross-brand, query boundary).

---

## 6. Metric corrections

- `marketingWarehouseCorrectionService.applyCorrection` appends `MarketingMetricCorrection` (history preserved)
- `buildCorrectionIndex` / `resolveEffectiveMetricValue` apply latest correction only
- `refreshDailyAggregates` sums effective values, not raw observations
- Reprocessing does not duplicate observations; corrections remain linked by `marketingMetricObservationId`

---

## 7. Lineage completeness

Every metric, event, and channel dimension created in a transaction also creates a `DataLineageRecord` (deduped per raw record + entity). Matched existing dimensions still receive lineage for the new raw record. Raw payloads are never mutated on reprocess.

---

## 8. Aggregate consistency

- Daily buckets use UTC `startOfDayUtc`
- Refresh runs in a single `$transaction` for all bucket upserts
- Failed runs marked `FAILED` with `errorMessage`; no partial commit
- Idempotent via `AggregateRefreshRun.idempotencyKey`
- Corrections included in recomputation

---

## 9. Data quality lifecycle

- Open issues deduped per `(rule, entityType, entityId)`
- Resolutions append-only in `DataQualityResolution`
- Resolved issues can receive new OPEN issues on subsequent checks
- All checks scoped to `organisationId` + `brandId`

---

## 10. Freshness states

Internal: `FRESH`, `STALE`, `CRITICAL`, `UNKNOWN`.  
`CRITICAL` maps to health `UNHEALTHY` (replaces task-spec `ERROR` for data age).  
Connector disabled/auth errors use `metadata.connectorState`, not freshness ladder.  
Documented in `docs/DATA_FRESHNESS.md`.

---

## 11. Schema versioning

- `ensureRawSchemaVersion` links `RawMarketingRecord.schemaVersionId` at ingest
- `ensureTransformationVersion` links `DataTransformationRun.transformationVersionId`
- Raw `inlinePayload` is immutable on reprocess; newer transformation versions re-derive canonical records only

---

## 12. Manual import safety

- CSV formula injection neutralised (`sanitizeCsvCell`)
- Mapping validation on create
- Duplicate import prevented by job idempotency + completed guard
- Chunked ingestion for large files
- Tenant-scoped throughout

---

## 13. Deferred dimensions

Documented extension strategy in `docs/MARKETING_DATA_MODEL.md` — additive tables and nullable FKs in 3.2.

---

## Remaining architecture gaps (non-blocking)

| Gap | Deferred to |
| --- | --- |
| Live provider adapters | Task 3.2 |
| Dedicated landing page / device / geography dimension tables | Task 3.2 |
| Weighted average for rate metrics in aggregates | Task 3.2 |
| Automated freshness cron | Task 3.2 |
| Playwright UI E2E for `/data/*` | Task 3.2 |

Live provider APIs, OAuth, external FX, and provider E2E are **not** gaps for Task 3.1 closure.
