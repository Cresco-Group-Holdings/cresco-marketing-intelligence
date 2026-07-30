# Competitor Search Intelligence

Task 4.3 provides a controlled competitor-analysis module for comparing public search presence, website structure, and content coverage.

## Overview

Users can register competitors, run restricted public crawls, import or observe keyword data, calculate overlaps with brand keywords, detect evidence-based content gaps, compare page structure, and request AI-assisted analysis — all using traceable public or licensed data.

## Models

| Model | Purpose |
|-------|---------|
| `SeoCompetitor` | Registered competitor with type, status, notes |
| `SeoCompetitorDomain` | Validated hostname(s) for crawl scope |
| `SeoCompetitorSnapshot` | Crawl run with page counts and status |
| `SeoCompetitorPage` | Public page inventory (URL, title, headings, topics, etc.) |
| `SeoCompetitorKeyword` | Keyword observation with source and date |
| `SeoKeywordOverlap` | Shared / brand-unique / competitor-unique keywords |
| `SeoContentGap` | Evidence-based gap with originality guidance |
| `SeoCompetitorTopic` | Aggregated topic coverage from crawled pages |
| `SeoCompetitorComparison` | Structural page comparison (no full text reproduction) |
| `SeoCompetitorEvidence` | Crawl and analysis evidence records |

## Competitor types

- `DIRECT` — same market/product
- `INDIRECT` — adjacent market
- `SEARCH_COMPETITOR` — competes in SERPs
- `CONTENT_COMPETITOR` — competes on content topics
- `ASPIRATIONAL` — benchmark target
- `OTHER`

## API endpoints

All routes are under `/api/brands/[brandId]/seo/competitors`:

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/` | read / manage |
| GET/PATCH | `/[competitorId]` | read / manage |
| POST | `/[competitorId]/crawl` | crawl |
| GET/POST | `/[competitorId]/keywords` | read / manage |
| GET/POST | `/keywords` | read |
| GET/POST | `/overlap` | read / analyze |
| GET/POST | `/content-gaps` | read / analyze |
| GET | `/topics` | read |
| POST | `/compare` | analyze |

## UI routes

- `/seo/competitors` — list and register competitors
- `/seo/competitors/[competitorId]` — detail, crawl, analysis
- `/seo/competitors/keywords` — keyword observations
- `/seo/competitors/content-gaps` — detected gaps
- `/seo/competitors/topics` — topic inventory
- `/seo/competitors/compare` — page structure comparison

## Permissions

- `seoCompetitors.read` — view competitors and analysis
- `seoCompetitors.manage` — create, update, archive, add keywords
- `seoCompetitors.crawl` — start restricted public crawls
- `seoCompetitors.analyze` — overlap, gaps, comparison, AI analysis

## Data principles

1. **No private analytics** — never claim access to competitor GA, GSC, or paid tools data
2. **No fabricated metrics** — traffic, rankings, backlinks, search volume, and revenue are never invented
3. **Traceable sources** — every keyword observation includes `source` and `observedAt`
4. **Originality** — gaps and AI output include guidance against copying competitor content

See also: [COMPETITOR_CRAWL_POLICY.md](./COMPETITOR_CRAWL_POLICY.md), [CONTENT_GAP_ANALYSIS.md](./CONTENT_GAP_ANALYSIS.md), [COMPETITOR_DATA_LIMITATIONS.md](./COMPETITOR_DATA_LIMITATIONS.md).
