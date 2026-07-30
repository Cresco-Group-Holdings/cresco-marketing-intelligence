# SEO Crawler Runbook

## Normal operations

### Start a crawl

1. Verify site domain is verified (`SeoSiteDomain.verificationStatus = VERIFIED`)
2. POST `/api/brands/{brandId}/seo/sites/{siteId}/crawl`
3. Monitor run status via UI or `GET /api/brands/{brandId}/seo/sites/{siteId}/crawl-runs`

### Worker processing

Crawl runs are processed by worker routes:
- `POST /api/seo-crawl/process-due` — batch process due runs
- `POST /api/seo-crawl/{runId}/process` — process specific run

Requires `Authorization: Bearer $PUBLISHING_WORKER_TOKEN`.

### Scheduled processing

Configure cron to hit `process-due` every 1–5 minutes.

## Monitoring

| Metric | Source | Alert threshold |
|--------|--------|-----------------|
| `crawl_failures` | `/api/seo/metrics` | > 10/hour |
| `ssrf_attempts` | `/api/seo/metrics` | > 0 |
| `blocked_pages` | `/api/seo/metrics` | Informational |
| `robots_fetch_failures` | `/api/seo/metrics` | > 5/hour |
| Queue backlog | `SeoCrawlQueueItem` PENDING count | > 1000 |

## Common issues

### Crawl stuck in RUNNING

1. Check `leaseExpiresAt` — expired leases are reclaimable
2. Run `process-due` manually
3. If worker crashed, run will resume from PENDING queue items

### Crawl fails immediately

1. Check domain verification status
2. Check `SEO_ENGINE_EMERGENCY_SHUTDOWN` env var
3. Check org quota (concurrent/daily limits)
4. Review run error message in `SeoCrawlRun.errorMessage`

### High SSRF attempts

1. Review `allowedDomains` configuration
2. Check for malicious queue items
3. Investigate source of invalid URLs

## Emergency procedures

```bash
# Stop all new crawls
SEO_ENGINE_EMERGENCY_SHUTDOWN=true

# Cancel active run
PATCH /api/brands/{brandId}/seo/crawl-runs/{runId} action=cancel
```

## Configuration reference

See `docs/SEO_CRAWL_CONFIGURATION.md` and `src/lib/seo/constants.ts`.
