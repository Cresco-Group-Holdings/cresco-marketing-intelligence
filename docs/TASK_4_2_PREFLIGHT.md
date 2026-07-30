# Task 4.2 Pre-flight Audit

## Reusable Infrastructure

| Component | Reuse for Keywords |
|-----------|-------------------|
| `MarketingSearchQuery` | GSC query sync source |
| `MarketingMetricObservation` | GSC impressions/clicks/CTR/position |
| `SeoCrawlPage` | Page mapping targets |
| `SeoSite` | Site-scoped keyword inventory |
| `marketing-manual-import-service` | CSV import pattern |
| `csv-safety.ts` | CSV injection protection |
| `ai-request-service` | Intent/entity/suggestion AI |
| `brand-knowledge-service` | Brand context for AI |
| `brandService.getById()` | Tenant scoping |

## Existing Models — Do Not Duplicate

- **MarketingSearchQuery** — warehouse GSC dimension; sync into `SeoKeyword` via adapter
- **MarketingLandingPage** — GSC page dimension; use `SeoCrawlPage` for crawl-native mapping
- **SeoCrawlPage** — page inventory from crawler; map keywords here

## GSC Integration

GSC data flows: Connector → Warehouse (`MarketingSearchQuery` + observations) → `seoKeywordGscSyncService` → `SeoKeyword` + `SeoKeywordMetric`.

Do not fabricate volume/CPC/difficulty from GSC — only impressions, clicks, CTR, position.

## Crawler Integration

Site content keywords extracted via `SITE_CONTENT` source (extension point). Crawl page titles/H1s can seed keyword discovery.

## Brand Knowledge Base

AI suggestions and entity extraction use `brandContextBuilder` + knowledge snapshot. No keyword metrics invented by AI.

## Manual CSV Framework

Reuses `sanitizeCsvRow`, idempotency keys, preview/confirm flow from warehouse imports.

## Tenant Context

All keyword queries scoped by `organisationId` + `brandId`. Unique key: `brandId + normalisedKeyword + language + country`.

## Known Constraints

- No fabricated search volume, CPC, difficulty, or ranking data
- AI suggestions labelled `isSuggestion: true` on source
- Manual intent overrides cannot be auto-overwritten
- Null metrics must not display as zero

## Database Migration Risks

- `SeoKeywordMetric` unique constraint includes nullable location/language — uses empty string sentinel
- Large metric snapshot tables — monitor growth with GSC sync

## Security

- CSV formula injection via `sanitizeCsvRow`
- Tenant isolation on all API routes
- AI cannot invent provider metrics
