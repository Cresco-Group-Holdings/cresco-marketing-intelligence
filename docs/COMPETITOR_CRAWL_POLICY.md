# Competitor Crawl Policy

Restricted public crawl mode for competitor domains. This policy governs `seo-competitor-crawl-service`.

## Allowed

- Public HTML pages on registered competitor hostnames
- Respecting `robots.txt` (default: enabled)
- Low concurrency (default: 1 request at a time)
- Strict page limits (default: 50 pages, depth 3)
- Evidence collection: URL, status, title, description, headings, canonical, word count, structured data types, internal link count, detected topics, content type, change detection

## Prohibited

| Rule | Enforcement |
|------|-------------|
| Authenticated areas | Path blocklist: `/login`, `/signin`, `/auth`, `/admin`, `/account`, `/checkout`, etc. |
| Form submission | GET-only fetches; no POST/PUT to endpoints |
| Personal data harvesting | No form fields, user profiles, or PII extraction |
| Private API discovery | `/api/` paths blocked; no API enumeration |
| Circumvention of blocking | Respects robots.txt and `X-Robots-Tag`; blocked paths recorded as evidence |
| SSRF | All URLs validated via `ssrf-guard` before fetch |

## Defaults

```typescript
maxPages: 50
maxDepth: 3
requestConcurrency: 1
requestDelayMs: 1000
requestTimeoutMs: 15000
redirectLimit: 3
maxContentBytes: 1 MiB
userAgent: CrescoCompetitorBot/1.0
respectRobotsTxt: true
```

## Archived competitors

Crawls cannot be started for competitors with `status: ARCHIVED`. In-progress snapshots are marked `BLOCKED` if the competitor is archived mid-run.

## Evidence

Each crawled page creates a `SeoCompetitorEvidence` record with type `page_crawl`. Robots-blocked URLs create `robots_blocked` evidence. Excerpts are truncated to 500 characters.
