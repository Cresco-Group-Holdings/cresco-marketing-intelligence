# SEO Crawler Operations

## Starting a Crawl

1. Create site at `/seo/sites/new`
2. Verify domain
3. Configure crawl at site detail
4. Start crawl from `/seo/sites/[id]/crawl`

## Worker Scheduling

Trigger worker via cron or manual call:

```bash
curl -X POST "https://app.example.com/api/seo-crawl/process-due" \
  -H "Authorization: Bearer $PUBLISHING_WORKER_TOKEN"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLISHING_WORKER_TOKEN` | — | Worker bearer token (required) |
| `SEO_CRAWL_MAX_PER_RUN` | 5 | Runs per worker pass |
| `SEO_CRAWL_QUEUE_BATCH` | 10 | URLs per process batch |
| `SEO_CRAWL_LEASE_MS` | 300000 | Worker lease duration |

## Monitoring

Counters in `src/lib/seo/observability.ts`:
- `crawls_enqueued`, `crawls_completed`, `crawl_failures`
- `ssrf_attempts`, `blocked_pages`, `http_failures`
- `oversized_pages`, `robots_fetch_failures`

## Stale Job Recovery

Runs in RUNNING state with expired `leaseExpiresAt` are reclaimed by the next worker pass.

## Exports

Available at `/api/brands/[brandId]/seo/sites/[siteId]/export?type=pages|issues|links|summary`

## Rollback

Migration: `20260730210000_task_4_1_seo_crawler`. Drop SEO tables to rollback schema (data loss).
