# Manual Import

Manual import is the **primary active ingest path** in Task 3.1. Operators upload CSV (or TSV/JSON/XLSX) files to load metrics, dimensions, events, and cost/revenue records into the warehouse without live connector integrations.

## Models

| Model | Purpose |
| --- | --- |
| `ManualImportJob` | Upload lifecycle and processing state |
| `ManualImportMapping` | Column → target field mapping |

## Job lifecycle

```
DRAFT → UPLOADED → MAPPING → VALIDATING → PROCESSING → COMPLETED
                                              ↓
                                           FAILED
                                              ↓
                                         CANCELLED
```

| Status | Meaning |
| --- | --- |
| `DRAFT` | Job created; no file yet |
| `UPLOADED` | File stored; awaiting column mapping |
| `MAPPING` | Operator configuring field mappings |
| `VALIDATING` | Schema and quality validation running |
| `PROCESSING` | Normaliser writing facts |
| `COMPLETED` | All rows processed (may include row-level failures) |
| `FAILED` | Terminal failure; no partial commit after validation |
| `CANCELLED` | Operator cancelled |

## Supported formats

`ManualImportFileFormat`: `CSV`, `TSV`, `JSON`, `XLSX`.

| Format | Notes |
| --- | --- |
| `CSV` / `TSV` | Default; UTF-8 encoding required |
| `JSON` | Array of row objects or NDJSON |
| `XLSX` | First sheet only in 3.1 |

Maximum file size: configurable via `MARKETING_WAREHOUSE_MAX_IMPORT_BYTES` (default 10 MB).

## Upload flow

### 1. Create job

```
POST /api/brands/[brandId]/marketing-data/imports
```

```json
{
  "fileName": "july-campaign-metrics.csv",
  "fileFormat": "CSV",
  "marketingDataSourceAccountId": "<optional account ID>"
}
```

Creates `ManualImportJob` in `DRAFT`. Permission: `marketingData.import`.

If no account ID is provided, a `MANUAL_IMPORT` source account is auto-provisioned for the brand.

### 2. Upload file

```
POST /api/brands/[brandId]/marketing-data/imports/[jobId]/upload
```

Multipart upload. File stored at `storagePath` (local filesystem in dev; object storage in production). Transitions to `UPLOADED`.

### 3. Configure mappings

```
PUT /api/brands/[brandId]/marketing-data/imports/[jobId]/mappings
```

```json
{
  "mappings": [
    { "sourceColumn": "date", "targetField": "observed_at", "isRequired": true },
    { "sourceColumn": "metric", "targetField": "metric_key", "isRequired": true },
    { "sourceColumn": "value", "targetField": "metric_value", "isRequired": true },
    { "sourceColumn": "campaign", "targetField": "campaign_name" },
    { "sourceColumn": "channel", "targetField": "channel_name" }
  ]
}
```

Target fields align with `MarketingDataSourceField` definitions for `MANUAL_IMPORT`. Transitions to `MAPPING` → `VALIDATING`.

### 4. Validate

Validation runs automatically on mapping save:

- Required columns mapped
- Sample row type coercion (dates, numbers)
- Referential checks (known campaigns/channels or auto-create policy)
- Data quality rules (`docs/DATA_QUALITY.md`)

Returns preview with row count, issue list, and sample normalised output. Operator confirms to proceed.

### 5. Process

```
POST /api/brands/[brandId]/marketing-data/imports/[jobId]/process
```

Transitions to `PROCESSING`:

1. Creates `RawMarketingBatch` (`syncType = MANUAL`, `provider = MANUAL_IMPORT`)
2. Writes one `RawMarketingRecord` per row
3. Runs stub normaliser
4. Runs quality checks
5. Triggers aggregate refresh
6. Completes job with `rowsProcessed` / `rowsFailed` counts

Idempotency: `ManualImportJob.idempotencyKey` prevents duplicate processing.

## Record types

Import rows map to record types via `record_type` column or mapping default:

| Record type | Warehouse output |
| --- | --- |
| `metric` | `MarketingMetricObservation` |
| `campaign` | `MarketingCampaign` dimension |
| `channel` | `MarketingChannel` dimension |
| `event` | `MarketingEvent` |
| `cost` | `MarketingCostRecord` |
| `revenue` | `MarketingRevenueRecord` |

Default record type: `metric`.

## Required fields by type

### Metric rows

| Field | Required | Notes |
| --- | --- | --- |
| `metric_key` | Yes | Canonical or provider key |
| `metric_value` | Yes | Numeric |
| `observed_at` | Yes | ISO 8601 datetime |
| `provider_record_id` | Recommended | Dedup key; auto-generated if omitted |

### Event rows

| Field | Required |
| --- | --- |
| `event_name` | Yes |
| `occurred_at` | Yes |
| `provider_event_id` | Yes |

See `docs/MARKETING_EVENTS.md`.

### Cost / revenue rows

| Field | Required |
| --- | --- |
| `amount` | Yes |
| `currency` | Yes (ISO 4217) |
| `period_start` / `recognised_at` | Yes |

## Column transforms

`ManualImportMapping.transformRule` supports:

| Rule | Example |
| --- | --- |
| `date:YYYY-MM-DD` | Parse date format |
| `number` | Coerce to decimal |
| `uppercase` | Normalise channel names |
| `trim` | Strip whitespace |
| `default:<value>` | Fill missing values |

## Error handling

| Failure | Behaviour |
| --- | --- |
| Validation error | Job stays in `VALIDATING`; no facts written |
| Row-level normaliser error | Row skipped; `rowsFailed++`; batch `PARTIAL` if any succeed |
| All rows fail | Job `FAILED`; batch `FAILED` |
| Duplicate `idempotencyKey` | Row skipped (idempotent) |

Row errors are stored in job `metadata.rowErrors` (safe messages only).

## Template download

```
GET /api/brands/[brandId]/marketing-data/imports/template?recordType=metric
```

Returns CSV template with headers matching `MarketingDataSourceField` for `MANUAL_IMPORT`.

## Security

- Upload restricted to `marketingData.import`
- File content scanned for size limits; no executable content
- Uploaded files must not contain credentials or API keys
- Raw uploaded files accessible only via `marketingData.viewRaw`
- Import actions audit-logged with `createdByUserId`

## Storage

| Environment | Storage |
| --- | --- |
| Development | Local path under `.data/imports/` |
| Production | Object storage via `storagePath` (same pattern as `RawMarketingPayloadReference`) |

Uploaded files retained for 90 days after job completion (configurable).

## Limitations (3.1)

- No incremental/update-by-key UI (re-import with same `provider_record_id` upserts via idempotency)
- No multi-sheet XLSX
- No automated column detection (AI-assisted mapping deferred)
- No scheduled recurring imports
- GA4/Ads export formats not auto-detected (manual mapping required)

## Related documentation

- `docs/MARKETING_DATA_WAREHOUSE.md` — manual import as primary ingest path
- `docs/METRIC_REGISTRY.md` — metric key conventions
- `docs/CHANNEL_TAXONOMY.md` — channel column mapping
- `docs/DATA_QUALITY.md` — import validation rules
- `docs/DATA_LINEAGE.md` — import provenance
- `docs/WAREHOUSE_OPERATIONS.md` — operations dashboard
