# Unified Marketing Data Warehouse

Task 3.1 establishes the persistence, ingestion framework, query layer, and operations surface for cross-source marketing intelligence. The warehouse sits **below** the existing connector and social analytics stacks — it does not replace them.

## Purpose

Stage 1 connectors (`docs/CONNECTOR_ARCHITECTURE.md`) and Stage 2 social analytics (`docs/SOCIAL_ANALYTICS.md`) each own their write paths. The warehouse adds:

1. A **canonical data model** for dimensions, metrics, events, revenue, and cost across providers.
2. A **raw ingestion layer** with batch lifecycle, idempotency, and lineage.
3. A **stub normaliser** that maps raw records into warehouse facts (live provider adapters deferred to Task 3.2+).
4. **Manual import** as the primary data-entry path in 3.1.
5. **Query and operations APIs** for health, freshness, quality, and reporting foundations.

## What is not in 3.1

| Capability | Status |
| --- | --- |
| Live GA4 sync | Deferred — registry entry only |
| Live Google Ads sync | Deferred — registry entry only |
| Live Google Search Console sync | Deferred — registry entry only |
| Connector → warehouse write path | Deferred — Task 3.2+ |
| Social ETL into warehouse | Read-bridge pattern only; no migration of existing `SocialPostMetric` rows |
| Probabilistic identity resolution | Schema only |
| Automated FX rate feeds | Manual/test rates only |
| Warehouse scheduler cron | Health API only; scheduler in 3.2 |
| Freshness alerting | Health records only; notifications in 3.2 |

## Architecture layers

```
┌─────────────────────────────────────────────────────────────────┐
│  UI / API  (brand-scoped routes, operations dashboards)         │
├─────────────────────────────────────────────────────────────────┤
│  Query services  (metrics, aggregates, health, lineage)         │
├─────────────────────────────────────────────────────────────────┤
│  Normaliser (stub)  RawMarketingRecord → dimensions + facts     │
├─────────────────────────────────────────────────────────────────┤
│  Ingestion  RawMarketingBatch, ManualImportJob, SOCIAL_BRIDGE   │
├─────────────────────────────────────────────────────────────────┤
│  Source registry  MarketingDataSource, accounts, capabilities   │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL  (Prisma models, migration 20260730100000)          │
└─────────────────────────────────────────────────────────────────┘
         ▲                    ▲                    ▲
         │                    │                    │
   Manual import         Social bridge         Connector adapters
   (3.1 active)          (read-only ETL)       (stubs / 3.2+)
```

### Layer 1 — Source registry

Global catalogue (`MarketingDataSource`) plus brand-scoped accounts (`MarketingDataSourceAccount`). Accounts optionally link to `ConnectorAccount` for future OAuth-backed ingest. Capabilities and field definitions describe what each source can supply.

See `docs/MARKETING_DATA_MODEL.md` for entity detail.

### Layer 2 — Raw ingestion

`RawMarketingBatch` follows the `SocialAnalyticsSync` lifecycle documented in `docs/TASK_3_1_PREFLIGHT.md`:

- Statuses: `QUEUED` → `RUNNING` → `COMPLETED` | `PARTIAL` | `FAILED` | `CANCELLED`
- Idempotency via unique `idempotencyKey`
- Worker lease fields (`workerId`, `leaseExpiresAt`, `heartbeatAt`)
- Cursor JSON for resumable paging
- Sync types: `SCHEDULED`, `MANUAL`, `BACKFILL`, `WEBHOOK`, `REPROCESS`

`RawMarketingRecord` stores provider payloads inline (`inlinePayload`) or via `RawMarketingPayloadReference` when payloads exceed inline limits. Raw payloads must not contain secrets — credentials remain in `ConnectorCredential` only.

### Layer 3 — Normaliser (stub)

The stub normaliser in `src/lib/warehouse/normaliser/` (Task 3.1) transforms validated `RawMarketingRecord` rows into:

- Dimension upserts (`MarketingChannel`, `MarketingCampaign`, etc.)
- Fact writes (`MarketingMetricObservation`, `MarketingEvent`, `MarketingCostRecord`, etc.)
- Lineage links (`DataLineageRecord`)

Provider-specific mapping logic is minimal in 3.1. `MANUAL_IMPORT` and test fixtures exercise the pipeline; GA4/Ads/Meta adapters register in the source catalogue but do not perform live sync.

Canonical type definitions originate from `src/lib/connectors/normalized-data.ts` (`docs/NORMALISED_MARKETING_DATA.md`).

### Layer 4 — Query services

Brand-scoped services expose:

- Metric observations and daily aggregates
- Dimension lookups
- Source health and freshness
- Data quality issue summaries
- Lineage traversal

Aggregates are **daily grain only** in 3.1 (`DailyMarketingAggregate`).

### Layer 5 — Operations

Health checks, manual import UI, batch monitoring, and quality resolution workflows. Worker routes authenticate via `src/lib/api/worker-auth.ts` (same pattern as social analytics scheduler).

## Social bridge pattern

Stage 2 social analytics persists observations in `SocialPostMetric` and `SocialAccountMetric`. The warehouse does **not** rewrite those services in 3.1.

Instead, a read-bridge adapter (`provider = SOCIAL_BRIDGE`) maps social facts into `MarketingMetricObservation` at query or scheduled-bridge time:

```
SocialPostMetric / SocialAccountMetric
        │  (read-only SELECT)
        ▼
Social bridge adapter  (source = SOCIAL)
        │  maps via SocialMetricDefinition → MarketingMetricMapping
        ▼
MarketingMetricObservation  (canonical cross-source fact table)
```

| Principle | Detail |
| --- | --- |
| Source of truth | Social tables remain authoritative for organic social |
| No dual-write | Social sync jobs do not write to warehouse tables |
| Parallel registries | `SocialMetricDefinition` and `MarketingMetricDefinition` coexist; unification deferred to 3.2 |
| Parallel job tables | `SocialAnalyticsSync` and `RawMarketingBatch` are not merged |
| Bridge idempotency | Observations use deterministic `idempotencyKey` derived from social snapshot keys |

Growth intelligence (`docs/GROWTH_INTELLIGENCE.md`) continues reading social metrics directly in 3.1.

## Relationship to connectors

| Component | Connector stack | Warehouse |
| --- | --- | --- |
| OAuth / credentials | `ConnectorCredential` | Optional FK via `MarketingDataSourceAccount.connectorAccountId` |
| Sync jobs | `ConnectorSync` | `RawMarketingBatch` (separate table) |
| Sync engine | `src/lib/connectors/sync/engine.ts` | Reused in 3.2+; not wired in 3.1 |
| Normalised types | `normalized-data.ts` | Prisma dimension/fact models |
| Catalogue | `ConnectorDefinition` | `MarketingDataSource` (linked, not replaced) |

## Feature flag

Warehouse routes and UI are gated by `MARKETING_WAREHOUSE_ENABLED` (default `false` in production until rollout). Follow the pattern in `src/lib/analytics/config.ts`.

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `MARKETING_WAREHOUSE_ENABLED` | Master feature toggle | `false` |
| `MARKETING_WAREHOUSE_MAX_BATCH_SIZE` | Max records per batch pass | `1000` |
| `MARKETING_WAREHOUSE_LEASE_SECONDS` | Worker lease duration | `300` |
| `MARKETING_WAREHOUSE_WORKER_BATCH` | Max batches per worker run | `10` |

Sync scheduler toggles and automated connector ingest env vars are deferred to Task 3.2.

## Permissions

Warehouse APIs require `marketingData.*` permissions. See `docs/SECURITY_BASELINE.md` and `docs/TASK_3_1_SECURITY_REVIEW.md`.

## Related documentation

- `docs/MARKETING_DATA_MODEL.md` — entity relationships
- `docs/METRIC_REGISTRY.md` — canonical metrics
- `docs/CHANNEL_TAXONOMY.md` — channel classification
- `docs/DATA_LINEAGE.md` — provenance tracking
- `docs/DATA_QUALITY.md` — quality rules and resolution
- `docs/DATA_FRESHNESS.md` — source health
- `docs/MARKETING_EVENTS.md` — events and identity
- `docs/CURRENCY_GOVERNANCE.md` — FX rates
- `docs/WAREHOUSE_OPERATIONS.md` — batch and worker operations
- `docs/MANUAL_IMPORT.md` — CSV import workflow
- `docs/TASK_3_1_PREFLIGHT.md` — pre-flight audit and decisions
