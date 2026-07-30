# SEO Crawler Architecture

## Overview

The technical SEO crawler is a tenant-safe, queue-backed system that discovers pages on verified websites, collects HTTP/HTML evidence, and produces deterministic technical SEO findings.

## Components

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  SEO UI     │────▶│  Brand API       │────▶│  seo-site-      │
│  /seo/*     │     │  /api/brands/    │     │  service        │
└─────────────┘     └──────────────────┘     └─────────────────┘
                            │                        │
                            ▼                        ▼
                    ┌──────────────────┐     ┌─────────────────┐
                    │  seo-crawl-      │────▶│  SeoCrawlRun    │
                    │  service         │     │  + QueueItems   │
                    └──────────────────┘     └─────────────────┘
                            ▲
                            │
                    ┌──────────────────┐
                    │  Worker          │
                    │  /api/seo-crawl/ │
                    │  process-due     │
                    └──────────────────┘
```

## Data Flow

1. User creates `SeoSite` and verifies domain.
2. User starts crawl → `SeoCrawlRun` (QUEUED) + seed `SeoCrawlQueueItem` rows.
3. Worker claims run, processes queue items in batches.
4. Each URL: SSRF check → robots check → HTTP fetch → HTML extract → snapshot + links + issues.
5. Run completes (COMPLETED) or resumes (PARTIAL) until queue empty.

## Key Models

| Model | Purpose |
|-------|---------|
| `SeoSite` | Registered website per brand |
| `SeoCrawlRun` | Durable crawl job with lease |
| `SeoCrawlQueueItem` | URL queue with idempotency |
| `SeoPageSnapshot` | Point-in-time page evidence |
| `SeoCrawlIssue` | Detected finding with evidence |

## Libraries

- `src/lib/seo/url-normalisation.ts` — versioned URL rules
- `src/lib/seo/ssrf-guard.ts` — SSRF prevention
- `src/lib/seo/robots-parser.ts` — robots.txt parsing
- `src/lib/seo/sitemap-parser.ts` — sitemap XML parsing
- `src/lib/seo/html-extractor.ts` — on-page extraction
- `src/lib/seo/issue-rules.ts` — deterministic rules
- `src/lib/seo/crawl-comparison.ts` — run diffing

## Worker

- `POST /api/seo-crawl/process-due` — drain queued runs
- `POST /api/seo-crawl/[runId]/process` — process single run
- Auth: `Authorization: Bearer $PUBLISHING_WORKER_TOKEN`
