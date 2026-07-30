# Task 3.1 Pre-Flight Audit

Audit date: 2026-07-30  
Branch: `cursor/marketing-data-warehouse-e94c`

## Purpose

Review Stage 1–2 infrastructure before building the Unified Marketing Data Warehouse (Task 3.1). This document records reusable assets, gaps, duplication risks, and deferred debt.

## Reusable connector infrastructure

| Asset | Location | Reuse for 3.1 |
|-------|----------|---------------|
| Connector catalogue | `ConnectorDefinition`, `src/lib/connectors/registry.ts` | Link `MarketingDataSource` registry; do not replace |
| Account + credential | `ConnectorAccount`, `ConnectorCredential` | `MarketingDataSourceAccount.connectorAccountId` optional FK |
| OAuth + PKCE | `connector-oauth-service.ts`, `OAuthAuthorisationState` | Ingestion auth for future GA4/Ads connectors |
| Sync engine | `src/lib/connectors/sync/engine.ts` | Batch paging, retries — wire to `RawMarketingBatch` |
| Sync metadata | `ConnectorSync`, `ConnectorSyncCursor`, `ConnectorError` | Parallel to warehouse batches; keep separate |
| Webhooks | `webhookService.ts` | Future `WEBHOOK` sync type on `RawMarketingBatch` |
| Canonical types | `src/lib/connectors/normalized-data.ts` | Schema design source for Prisma models |
| Docs | `docs/CONNECTOR_ARCHITECTURE.md`, `docs/SYNC_ENGINE.md` | Reference architecture |

**Decision:** Do not rewrite connector modules. Warehouse adds a **persistence and query layer** beneath adapters.

## Existing analytics models (duplication risk)

| Model | Domain | Warehouse relationship |
|-------|--------|------------------------|
| `SocialPostMetric` | Organic social post metrics | **Keep as source.** ETL/read adapter into `MarketingMetricObservation` with `source=SOCIAL` |
| `SocialAccountMetric` | Account-level social | Same |
| `SocialMetricDefinition` | Social provider registry | Parallel to `MarketingMetricDefinition`; migrate mappings over time |
| `SocialAnalyticsSync` | Social sync jobs | Parallel to `RawMarketingBatch`; do not merge job tables |

**Decision:** No rewrite of `social-analytics-*` services in 3.1. Document bridge pattern in `docs/MARKETING_DATA_WAREHOUSE.md`.

## Job execution architecture

| Pattern | Implementation | 3.1 reuse |
|---------|----------------|-----------|
| Durable DB jobs | `SocialAnalyticsSync`, `PublishingJob`, `ConnectorSync` | `RawMarketingBatch` + lease fields |
| Worker auth | `src/lib/api/worker-auth.ts` | Warehouse worker routes |
| Scheduler cron | `.github/workflows/social-analytics-scheduler.yml` | Future warehouse scheduler (3.2+) |
| Generic job abstraction | `src/lib/jobs/*` | Extension point; not wired to Prisma yet |
| Inline sync (connectors) | `connectorSyncService` | Dev/test only per `KNOWN_LIMITATIONS.md` |

**Decision:** `RawMarketingBatch` follows `SocialAnalyticsSync` idempotency + status lifecycle.

## Tenant context and RBAC

- `TenantContext`, `assertOrganisationScope`, `withApiHandler` — use unchanged
- New permissions: `marketingData.*` (see Task 3.1 §24)
- Raw payload access restricted to `marketingData.viewRaw`

## Encryption service

- `src/lib/security/encryption.ts` — credentials only; raw payloads must not contain secrets
- Large payloads → `RawMarketingPayloadReference` (object storage path)

## Audit logging

- `recordAuditEvent()` for ingest, reprocess, quality resolution, manual import
- Request IDs via `withApiHandler` envelope

## Feature flags

- Follow `src/lib/analytics/config.ts` pattern for warehouse: `MARKETING_WAREHOUSE_ENABLED`, sync toggles (3.2)

## Notification framework

- Stage 2 notifications on separate branch; not on `main`
- Warehouse freshness alerts deferred to 3.2 (health API only in 3.1)

## Stage 2 production readiness findings

From `docs/STAGE_2_PRODUCTION_READINESS.md` (PR #37):

- Mock OAuth adapters — does not block warehouse schema; blocks live connector ingest until production adapters ship
- Social inbox missing — events/leads in warehouse use first-party + manual import in 3.1
- Publishing scheduler added in 2.20 — unrelated to warehouse ingest

## Database limitations

- PostgreSQL JSON columns for `payload`, `dimensions`, `properties` — indexed via tenant + date keys, not JSON paths (initially)
- Serverless connection pooling required for Vercel (`DATABASE_URL` pooler)
- Large backfills need batch size limits (`MARKETING_WAREHOUSE_MAX_BATCH_SIZE`)

## Migration risks

- Large schema addition (~50 models) — single migration `20260730100000_task_3_1_marketing_data_warehouse`
- No data migration from social metrics in 3.1 (read-bridge only)
- `MarketingCampaign` is warehouse dimension — distinct from future `ContentCampaign` (Stage 2 ops)

## Required refactoring (deferred)

| Item | Reason deferred |
|------|-----------------|
| Unify `SocialMetricDefinition` → `MarketingMetricDefinition` | Requires social ETL; Task 3.2 |
| Wire `DatabaseJobProvider` to Prisma | Generic job table; Task 3.2 |
| Connector sync writes to warehouse | Adapter work per provider; Task 3.2+ |
| Cross-source attribution | Out of scope 3.1 |

## Duplicated metric models

- **Social:** `SocialPostMetric`, `SocialAccountMetric` (keep)
- **Warehouse:** `MarketingMetricObservation` (new canonical cross-source fact table)
- **Growth:** reads social metrics directly — unchanged in 3.1

## Technical debt accepted for 3.1

1. Provider adapters are stubs / manual import only — no GA4/Ads live sync
2. Aggregates are daily grain only
3. No probabilistic identity resolution
4. FX rates manual/test only
5. No external observability backend

## Sign-off

Pre-flight complete. Proceed with warehouse schema, ingestion framework, query services, and operations UI without modifying Stage 1 connector or Stage 2 social analytics write paths.
