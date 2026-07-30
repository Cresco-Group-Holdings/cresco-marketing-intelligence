# Keyword Intelligence

## Overview

Canonical keyword system combining Search Console queries, manual entry, CSV imports, site content, and AI suggestions — organised by intent, topic, brand, language, location, and page relationship.

## Architecture

```
Sources                    Canonical Store              Analysis
─────────                  ───────────────              ────────
GSC (warehouse)     ──▶   SeoKeyword          ──▶     Opportunities
Manual entry        ──▶   + SeoKeywordSource  ──▶     Cannibalisation
CSV import          ──▶   + SeoKeywordMetric  ──▶     Page mapping
AI suggestions      ──▶   + SeoKeywordIntent  ──▶     Groups
Site content        ──▶   + SeoKeywordEntity
```

## Key Models

| Model | Purpose |
|-------|---------|
| `SeoKeyword` | Canonical keyword per brand/locale |
| `SeoKeywordSource` | Provenance tracking with `isSuggestion` flag |
| `SeoKeywordMetric` | Optional metrics with provider/source |
| `SeoKeywordIntent` | Intent classification with manual override |
| `SeoKeywordPageMapping` | Keyword-to-page relationships |
| `SeoKeywordOpportunity` | Evidence-based opportunities |
| `SeoKeywordGroup` | Topic/campaign/funnel groupings |

## API

- `GET/POST /api/brands/[brandId]/seo/keywords`
- `GET/PATCH/POST /api/brands/[brandId]/seo/keywords/[keywordId]`
- `POST/PATCH /api/brands/[brandId]/seo/keywords/import`
- `GET/POST /api/brands/[brandId]/seo/keywords/groups`
- `GET/POST /api/brands/[brandId]/seo/keywords/opportunities`

## UI

- `/seo/keywords` — list, search, manual add, GSC sync
- `/seo/keywords/import` — CSV import
- `/seo/keywords/groups` — keyword groups
- `/seo/keywords/opportunities` — opportunity review
- `/seo/keywords/cannibalisation` — cannibalisation candidates
- `/seo/keywords/[keywordId]` — keyword detail
