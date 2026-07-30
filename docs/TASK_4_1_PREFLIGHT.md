# Task 4.1 Pre-flight Audit

## Reusable Infrastructure

| Component | Location | Reuse for SEO |
|-----------|----------|---------------|
| Durable job pattern | `SocialAnalyticsSync`, `social-analytics-sync-service.ts` | `SeoCrawlRun` queue/lease model |
| Worker auth | `src/lib/api/worker-auth.ts` | `PUBLISHING_WORKER_TOKEN` bearer auth |
| Tenant scoping | `brandService.getById()`, `TenantContext` | All SEO services |
| Raw payload storage pattern | `RawMarketingPayloadReference` | `SeoPageSnapshot.rawReference` extension point |
| Tracking domains | `TrackingDomain`, `TrackingProperty` | Domain verification via `TRACKING_PROPERTY` method |
| GSC integration | `gsc-sync-service.ts`, `SearchConsoleSitemap` | `SEARCH_CONSOLE` verification; separate from crawler sitemaps |
| Marketing landing pages | `MarketingLandingPage` | URL registry for GSC; do not duplicate for crawl inventory |
| Observability | `incrementAnalyticsCounter` pattern | `src/lib/seo/observability.ts` |

## Existing URL and Page Models

- **TrackingProperty / TrackingDomain** — first-party analytics domains; auto-verified for tracking, not crawl-authoritative.
- **MarketingLandingPage** — GSC page dimension; warehouse-only.
- **SearchConsoleSitemap** — GSC API metadata; not XML-parsed.
- **SeoCrawlPage / SeoPageSnapshot** — new crawl-native inventory (Task 4.1).

## Crawl Job Architecture

Postgres-row queue (`SeoCrawlQueueItem`) with worker polling (`/api/seo-crawl/process-due`). No Redis. Lease-based recovery mirrors social analytics sync.

## Queue Limitations

- Single-process worker batching; no distributed queue.
- Concurrency bounded per crawl configuration (`requestConcurrency`, `maxPages`).
- Partial completion via `PARTIAL` status when batch limit reached.

## Database Migration Risks

- Large crawl tables (`SeoPageSnapshot`, `SeoCrawlLink`) may grow quickly — monitor storage.
- `SeoCrawlIssue` references `SeoIssueDefinition.ruleId` with RESTRICT — definitions must be seeded before issues.
- Cross-tenant isolation relies on `organisationId` + `brandId` indexes on all tenant tables.

## Security Concerns

- SSRF prevention required before any production crawl (`src/lib/seo/ssrf-guard.ts`).
- Domain verification mandatory before crawl (`SeoSite.status`, `SeoSiteDomain.verificationStatus`).
- Custom headers restricted to safe values in configuration validation.
- No robots.txt bypass via user-agent rotation.

## Areas Requiring Refactoring

- `DatabaseJobProvider` abstract — not wired; SEO uses direct Prisma polling.
- GSC sitemap model separate from `SeoSitemap` — intentional separation.
- HTML extraction uses regex-based parser; consider cheerio for production accuracy.

## Known Constraints

- No JavaScript rendering in v1 (extension point in `SeoCrawlConfiguration`).
- No keyword research, AI article generation, or website modification.
- Crawl scope limited to verified domains.
- Worker depends on `PUBLISHING_WORKER_TOKEN` env var.
