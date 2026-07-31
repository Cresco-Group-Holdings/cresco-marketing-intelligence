# Metric Registry

Canonical marketing metrics are defined in `MarketingMetricDefinition` and mapped from provider-specific fields via `MarketingMetricMapping`. This registry is the cross-source vocabulary for `MarketingMetricObservation` and `DailyMarketingAggregate`.

## Design principles

1. **One canonical key per concept** — `impressions`, `clicks`, `spend`, etc. are provider-independent.
2. **Never substitute metrics** — if a provider does not return a field, the observation is omitted (same rule as `docs/SOCIAL_ANALYTICS.md`).
3. **Derived metrics are computed, not stored as source observations** — engagement rate, CTR, and ROAS are calculated from numerators and denominators at query time unless explicitly stored with `source = DERIVED`.
4. **Aggregation rules are explicit** — `MarketingMetricAggregation` (`SUM`, `AVG`, `MAX`, `MIN`, `COUNT`, `LAST`) is set per definition.
5. **Post-level percentages are never averaged** — derived rates use aggregated numerators and denominators.

## Registry layers

```
┌──────────────────────────────────────────────────────────┐
│  MarketingMetricDefinition  (canonical)                  │
│    canonicalKey, unit, dataType, aggregation             │
├──────────────────────────────────────────────────────────┤
│  MarketingMetricMapping  (provider → canonical)          │
│    provider, providerMetricKey, transformExpression      │
├──────────────────────────────────────────────────────────┤
│  MarketingMetricObservation  (facts)                     │
│    metricKey, metricValue, source, dimensions            │
└──────────────────────────────────────────────────────────┘
```

## Scope levels

Definitions may be scoped at different tenant levels:

| Scope | `organisationId` / `projectId` / `brandId` | Use |
| --- | --- | --- |
| Global seed | all `null` | Platform-wide defaults (future) |
| Brand | `brandId` set | Brand-specific custom metrics |
| Organisation | `organisationId` only | Shared across brands (future) |

Unique constraint: `[brandId, canonicalKey]`.

## Default seed metrics (Task 3.1)

`DEFAULT_METRIC_DEFINITIONS` in `src/lib/warehouse/metric-registry.ts` seeds **exactly 10** canonical metrics per brand on first normalisation:

| # | `canonicalKey` | Unit | `dataType` | `aggregation` | `isCumulative` |
| --- | --- | --- | --- | --- | --- |
| 1 | `sessions` | count | `INTEGER` | `SUM` | false |
| 2 | `users` | count | `INTEGER` | `SUM` | false |
| 3 | `pageviews` | count | `INTEGER` | `SUM` | false |
| 4 | `impressions` | count | `INTEGER` | `SUM` | true |
| 5 | `clicks` | count | `INTEGER` | `SUM` | true |
| 6 | `conversions` | count | `INTEGER` | `SUM` | false |
| 7 | `revenue` | currency | `CURRENCY` | `SUM` | false |
| 8 | `cost` | currency | `CURRENCY` | `SUM` | false |
| 9 | `ctr` | percentage | `PERCENTAGE` | `AVG` | false |
| 10 | `engagement_rate` | percentage | `PERCENTAGE` | `AVG` | false |

Uniqueness: `@@unique([brandId, canonicalKey])` on `MarketingMetricDefinition`. Non-additive rates (`ctr`, `engagement_rate`) use `AVG` aggregation and must not be summed in daily rollups without numerator/denominator logic (deferred to query-time derivation in 3.2).

## Data types

`MarketingMetricDataType`:

| Type | Example metrics |
| --- | --- |
| `INTEGER` | impressions, clicks, conversions |
| `DECIMAL` | average position, bid amounts |
| `PERCENTAGE` | CTR, bounce rate (stored only when provider supplies; prefer derivation) |
| `CURRENCY` | spend, revenue |
| `DURATION` | session duration, watch time |
| `RATIO` | ROAS, CPA (prefer derivation) |

## Source attribution

`MarketingMetricSource` on each observation:

| Source | Origin |
| --- | --- |
| `CONNECTOR` | Future connector adapter ingest (3.2+) |
| `SOCIAL` | Social bridge from `SocialPostMetric` / `SocialAccountMetric` |
| `MANUAL_IMPORT` | CSV/manual upload |
| `FIRST_PARTY` | On-platform events and tracking |
| `DERIVED` | Computed and persisted (optional) |
| `CORRECTION` | Operator correction via `MarketingMetricCorrection` |

## Social metric bridge

Stage 2 social metrics are defined in `src/lib/social/metric-registry.ts` (`SOCIAL_METRIC_REGISTRY`) and mirrored into `SocialMetricDefinition`.

In 3.1, `SocialMetricDefinition` and `MarketingMetricDefinition` are **parallel registries**. Bridge mappings translate social canonical names to warehouse canonical keys:

| Social canonical (`metric-registry.ts`) | Warehouse `canonicalKey` | Notes |
| --- | --- | --- |
| `impressions` | `impressions` | Direct map |
| `reach` | `reach` | Omitted when provider unavailable |
| `views` | `views` | Distinct from impressions |
| `likes` | `likes` | Includes reactions where mapped |
| `comments` | `comments` | |
| `shares` | `shares` | |
| `saves` | `saves` | Instagram-only |
| `clicks` | `clicks` | |
| `follows` | `follows` | Account scope |
| `subscribers` | `subscribers` | YouTube-only; never merged with follows |
| `engagementRate` | — | **Derived** at query time, not bridged as source observation |

Unification of `SocialMetricDefinition` → `MarketingMetricDefinition` is deferred to Task 3.2.

## Manual import metrics

Manual import maps CSV columns to `MarketingDataSourceField` entries flagged `isMetric = true`. The normaliser resolves the target `MarketingMetricDefinition` via `canonicalKey` or creates a brand-scoped definition when permitted.

Required import columns for metric rows:

- `metric_key` or mapped equivalent
- `metric_value`
- `observed_at` (ISO 8601)
- Optional dimension columns (campaign, channel, content)

## Derived metrics (query-time)

These are **not** stored as provider observations in 3.1:

| Metric | Formula | Preconditions |
| --- | --- | --- |
| Engagement rate | `(likes + reactions + comments + shares + saves) / impressions × 100` | Impressions and at least one interaction |
| CTR | `clicks / impressions × 100` | Both fields present; impressions > 0 |
| Follower growth | Latest follower count − earliest in range | Same metric type throughout range |
| CPA | `spend / conversions` | Both present; conversions > 0 |
| ROAS | `revenue / spend` | Both present; spend > 0 |

Formulas mirror `docs/SOCIAL_ANALYTICS.md` for social-sourced metrics.

## Corrections

`MarketingMetricCorrection` overlays operator adjustments without mutating the original observation:

- Links to `marketingMetricObservationId` when correcting a specific row
- Stored with `source` implied as correction layer at query time
- Requires `marketingData.manage` permission and audit event

## Daily aggregates

`DailyMarketingAggregate` pre-computes daily rollups:

- Keyed by `[brandId, metricKey, aggregateDate, dimensionKey, dimensionValue]`
- `sampleCount` tracks contributing observations
- Refresh triggered by `AggregateRefreshRun` after batch completion
- **Daily grain only** in 3.1

## Provider registry entries (inactive in 3.1)

The following providers have catalogue entries and field definitions but **no live metric ingest** in 3.1:

- `GA4` — sessions, users, events (stub normaliser only)
- `GOOGLE_ADS` — impressions, clicks, spend, conversions (stub)
- `GOOGLE_SEARCH_CONSOLE` — clicks, impressions, CTR, position (stub)
- `META` — paid social metrics (stub)

## Seeding

Global metric definitions and provider mappings are seeded during migration or via `prisma/seed` warehouse section. Brand-specific overrides are created through the operations UI or API.

## Related documentation

- `docs/SOCIAL_ANALYTICS.md` — social metric formulas and provider limitations
- `docs/NORMALISED_MARKETING_DATA.md` — `NormalisedMetricObservation` type
- `docs/MARKETING_DATA_MODEL.md` — metric entity relationships
- `docs/DATA_QUALITY.md` — range and completeness rules on metrics
