# Rank Data Sources

All rank data must come from licensed or official sources. **Do not scrape search engines in violation of their terms.**

## Supported sources

| Source | Enum | Description |
|--------|------|-------------|
| Search Console | `SEARCH_CONSOLE` | Google Search Console via official API connector |
| Rank provider | `RANK_PROVIDER` | Approved third-party rank-tracking provider |
| Manual import | `MANUAL_IMPORT` | User-uploaded observation data |
| Compliant SERP | `COMPLIANT_SERP` | Explicitly licensed/compliant SERP data source |

## Required observation fields

Every `SeoRankObservation` must contain:

- `source` — data source enum
- `keyword` — tracked query
- `location` — country/region
- `language` — language code
- `device` — DESKTOP, MOBILE, TABLET, or ALL
- `observedDate` — date of observation
- `rank` — position (1–100) or **null** for missing data
- `resultType` — ORGANIC, FEATURED_SNIPPET, etc.
- `providerMetadata` — source-specific JSON metadata

Optional GSC fields: `impressions`, `clicks`, `ctr`, `rankingUrl`.

## Import rules

- Observations are idempotent per `trackedKeywordId + source + date + device + resultType`
- Null rank means missing data — never stored or displayed as zero
- Provider sync status tracked on `SeoRankTrackingProject.lastSyncAt`

## GSC integration

Search Console data flows through the existing connector:

```
GSC Connector → gsc-sync-service → MarketingMetricObservation
                                         ↓
                    seoKeywordGscSyncService (keyword metrics)
                                         ↓
                    seoRankObservationService.importObservations (rank tracking)
```

GSC data is typically 2–3 days delayed. Do not fabricate volume, CPC, or difficulty metrics from GSC.
