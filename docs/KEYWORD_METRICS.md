# Keyword Metrics

## Supported Metrics

| Metric | Source | Nullable |
|--------|--------|----------|
| IMPRESSIONS | GSC, CSV | Yes |
| CLICKS | GSC, CSV | Yes |
| CTR | GSC | Yes |
| AVERAGE_POSITION | GSC | Yes |
| SEARCH_VOLUME | CSV, Provider | Yes |
| CPC | CSV, Provider | Yes |
| DIFFICULTY | CSV, Provider | Yes |
| RANK_POSITION | CSV | Yes |
| RANKING_URL | CSV, GSC | Yes |

## Metric Record Fields

- `provider` — data provider name
- `source` — `SeoKeywordSourceType`
- `location`, `language` — geographic scope
- `measuredAt`, `periodStart`, `periodEnd`
- `confidence`, `freshness`, `providerDefinition`

## Display Rules

- **Null must not display as zero** — use `formatMetricDisplay()` which returns `null` for missing values
- Stale metrics flagged via `isMetricStale()` (default 30 days)
- GSC metrics have `confidence: 1` (verified provider data)
- CSV metrics have `confidence: 0.8` with provider label

## No Fabrication

The platform never generates search volume, CPC, difficulty, or ranking data. AI suggestions explicitly exclude metrics.
