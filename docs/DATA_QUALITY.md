# Data Quality

The warehouse data quality framework detects, tracks, and resolves anomalies in ingested and transformed marketing data. Rules run after normalisation and optionally on aggregate refresh.

## Models

| Model | Purpose |
| --- | --- |
| `DataQualityRule` | Brand-scoped validation definition |
| `DataQualityCheck` | Execution result (per rule, optionally per batch) |
| `DataQualityIssue` | Detected problem on a specific entity |
| `DataQualityResolution` | Operator action on an issue |

## Rule types

`DataQualityRuleType`:

| Type | Checks |
| --- | --- |
| `COMPLETENESS` | Required fields present; minimum observation count |
| `FRESHNESS` | Data age within SLA (see `docs/DATA_FRESHNESS.md`) |
| `UNIQUENESS` | Duplicate detection beyond idempotency constraints |
| `RANGE` | Metric values within expected bounds |
| `CONSISTENCY` | Cross-field logic (e.g. `periodEnd >= periodStart`) |
| `REFERENTIAL` | Foreign key integrity (campaign exists, channel active) |
| `CUSTOM` | Brand-defined JSON expression |

## Rule definition

`DataQualityRule` fields:

| Field | Purpose |
| --- | --- |
| `name` | Human-readable label |
| `targetEntity` | Entity type checked (`MarketingMetricObservation`, `RawMarketingRecord`, etc.) |
| `ruleExpression` | JSON spec interpreted by the quality engine |
| `severity` | Default issue severity: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `isActive` | Enable without deletion |

### Example rules (seeded defaults)

| Name | Type | Expression summary |
| --- | --- | --- |
| `metric-value-non-negative` | `RANGE` | `metricValue >= 0` for count metrics |
| `observation-has-timestamp` | `COMPLETENESS` | `observedAt` is not null |
| `batch-record-count` | `COMPLETENESS` | `recordsProcessed > 0` on batch completion |
| `campaign-date-order` | `CONSISTENCY` | `endDate >= startDate` when both set |
| `duplicate-idempotency` | `UNIQUENESS` | No duplicate `idempotencyKey` within batch window |
| `source-freshness-24h` | `FRESHNESS` | Last successful sync within 24 hours (warning only in 3.1) |

## Check execution

Checks run:

1. **Post-normalisation** — after `DataTransformationRun` completes for a batch
2. **On manual import validation** — during `VALIDATING` status
3. **On aggregate refresh** — optional consistency check on rollups
4. **On-demand** — operator-triggered re-check via API

`DataQualityCheck` records:

- `status`: `PASSED`, `FAILED`, `WARNING`, `SKIPPED`, `ERROR`
- `recordsChecked`, `issuesFound`
- Optional `rawMarketingBatchId` link

## Issues

`DataQualityIssue` captures individual failures:

| Field | Purpose |
| --- | --- |
| `entityType` + `entityId` | Affected record |
| `severity` | May override rule default |
| `status` | `OPEN`, `ACKNOWLEDGED`, `RESOLVED`, `SUPPRESSED` |
| `message` | Human-readable description |
| `details` | JSON context (field values, thresholds) |
| `detectedAt` / `resolvedAt` | Timestamps |

Open `CRITICAL` issues surface on the warehouse operations dashboard.

## Resolution workflow

Operators with `marketingData.manage` resolve issues via `DataQualityResolution`:

| Action | Effect |
| --- | --- |
| `CORRECTED` | Underlying data fixed (correction or re-import) |
| `SUPPRESSED` | Issue acknowledged; rule suppressed for entity |
| `DEFERRED` | Acknowledged; fix planned |
| `FALSE_POSITIVE` | Rule misfire; may adjust rule |
| `REPROCESSED` | Batch re-run resolved the issue |

All resolutions are audit-logged with `resolvedByUserId`.

## Manual import validation

During `ManualImportJob` status `VALIDATING`:

1. Schema validation against `MarketingDataSourceField` definitions
2. Row-level completeness and range checks
3. Referential checks (campaign/channel IDs exist or will be created)
4. Preview of issues before `PROCESSING`

Failed validation returns to `MAPPING` with issue details; no facts are written until validation passes.

## Stub normaliser quality

The stub normaliser in 3.1 runs a minimal rule set:

- Reject records with missing `providerRecordId`
- Reject metric rows without `metric_key` and `metric_value`
- Warn on unknown `metric_key` (creates brand definition if permitted)
- Skip GA4/Ads stub records with `status = REJECTED` and reason `provider_not_active`

Live provider quality rules expand in 3.2 when adapters ship.

## Interaction with freshness

`FRESHNESS` rules overlap with `MarketingDataSourceHealth` (see `docs/DATA_FRESHNESS.md`). Health records are point-in-time operational status; quality freshness rules are brand-configurable SLAs that raise issues.

## Permissions

| Action | Permission |
| --- | --- |
| View issues and checks | `marketingData.read` |
| Acknowledge / resolve | `marketingData.manage` |
| Create / edit rules | `marketingData.manage` |
| Suppress rules | `marketingData.admin` |

## Related documentation

- `docs/DATA_FRESHNESS.md` — source health and lag
- `docs/DATA_LINEAGE.md` — trace issues to source records
- `docs/WAREHOUSE_OPERATIONS.md` — operations dashboard
- `docs/MANUAL_IMPORT.md` — import validation stage
