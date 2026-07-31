# SEO Engine Architecture

## Overview

The AI SEO Engine (Stage 4, Tasks 4.1–4.9) provides technical SEO crawling, keyword intelligence, competitor analysis, content strategy, AI-assisted content creation, on-page optimisation, internal linking, rank tracking, and content refresh workflows.

```
┌─────────────────────────────────────────────────────────────────┐
│                        SEO Dashboard UI                          │
│  /seo/sites  /seo/keywords  /seo/briefs  /seo/on-page  etc.    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ apiFetch (organisationId scoped)
┌──────────────────────────▼──────────────────────────────────────┐
│                     API Routes (RBAC)                            │
│  seo-handler  keywords-handler  briefs-handler  on-page-handler  │
│  internal-links-handler  rank-tracking-handler                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     Service Layer                                 │
│  seo-crawl-service    seo-keyword-service    seo-brief-ai-service │
│  on-page-audit-service  internal-link-build-service               │
│  seo-rank-tracking-service  seo-content-refresh-service         │
└──────┬──────────────────┬───────────────────┬────────────────────┘
       │                  │                   │
┌──────▼──────┐  ┌────────▼────────┐  ┌──────▼──────┐
│  Crawler    │  │  AI Core        │  │  Warehouse  │
│  SSRF guard │  │  ai-request-    │  │  GSC sync   │
│  robots     │  │  service        │  │  metrics    │
│  html-parse │  │  cost-controls  │  │             │
└──────┬──────┘  └────────┬────────┘  └──────┬──────┘
       │                  │                   │
┌──────▼──────────────────▼───────────────────▼────────────────────┐
│                     PostgreSQL (Prisma)                             │
│  SeoSite  SeoCrawlPage  SeoKeyword  SeoContentBrief              │
│  OnPageSeoAudit  InternalLinkGraph  SeoRankTrackingProject        │
└──────────────────────────────────────────────────────────────────┘
```

## Tenant model

Every SEO entity carries:
- `organisationId` — tenant boundary
- `projectId` — workspace project
- `brandId` — brand within project

API handlers require `organisationId` query param and verify RBAC via `withApiHandler`.

## Crawl pipeline

1. User creates `SeoSite` → verifies domain
2. `seoCrawlService.enqueue()` — quota check, idempotency key
3. Worker claims run via lease (`PUBLISHING_WORKER_TOKEN`)
4. `process()` — robots fetch, queue batch, SSRF-safe fetch, HTML extract
5. Issues evaluated, pages stored, run finalised

## AI pipeline

1. User triggers AI action (brief, long-form, on-page review, etc.)
2. `aiRequestService.execute()` — scope check, injection detection, redaction
3. Structured output validated against Zod schema
4. Usage recorded in `AIUsageRecord`
5. Human review required before publish

## Data flow: GSC → Keywords → Rank tracking

```
GSC Connector → gsc-sync-service → MarketingMetricObservation
                                         ↓
                    seoKeywordGscSyncService
                                         ↓
                    SeoKeyword + SeoKeywordMetric
                                         ↓
                    seoRankObservationService (rank tracking import)
```

## No auto-publish

All content workflows terminate at review/approval/proposal states. No SEO service calls publishing endpoints.
