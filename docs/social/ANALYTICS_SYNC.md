# Publication Analytics Sync

## Identity chain

```
Publication.id
  ↔ ProviderConnection (connectionId)
  ↔ externalPublicationId (Meta media ID)
  ↔ Instagram Insights API
  ↔ PublicationMetric rows
```

## Flow

1. After successful publish, worker calls `publicationAnalyticsSyncService.enqueueForPublication`
2. Scheduler pass runs `processDueSyncs`
3. `tokenLifecycleService` provides token (same connection as publish)
4. `InstagramAnalyticsAdapter.fetchPostMetrics`
5. Metrics stored in `PublicationMetric` with idempotency key
6. `PublicationAnalyticsSync` tracks cursor, last sync, rate-limit state

## Metrics

Only metrics returned by Meta for the post/content type are stored. Common launch metrics:

- impressions / views
- reach
- likes
- comments
- saves
- shares

Unavailable metrics are listed in `unavailableMetrics` — UI shows **"Awaiting provider data"**, not zero placeholders.

## Manual refresh

`POST /api/brands/{brandId}/publications/{id}/metrics/sync` enqueues canonical sync (not direct browser → Meta).

## Incrementality

- `PublicationAnalyticsSync.syncCursor` stores post-level cursor
- Idempotency key: `sha256(publicationId:metric:period:measuredAt)`
- Re-sync within 15 minutes skipped unless `force: true`
