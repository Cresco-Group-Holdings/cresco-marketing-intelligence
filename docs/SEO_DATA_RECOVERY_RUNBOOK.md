# SEO Data Recovery Runbook

## Backup strategy

- **Database:** Daily automated backups via hosting provider
- **Before migration:** Manual `pg_dump` recommended
- **Crawl snapshots:** Stored in PostgreSQL; no separate object storage

## Recovery scenarios

### Accidental site deletion

1. Restore from database backup to point before deletion
2. Or: recreate site, re-verify domain, re-crawl
3. Keyword/brief data lost if cascade deleted — restore from backup if critical

### Corrupted crawl run

1. Cancel run: `status = CANCELLED`
2. Enqueue new crawl with fresh `idempotencyKey`
3. Previous `SeoCrawlPage` records remain (upsert by URL)

### Lost AI-generated content

1. Check `LongFormContentVersion` history
2. Check `SeoContentBriefVersion` history
3. `AIRequest` records contain input digest (not full prompt) for audit

### Rank observation data gap

1. Re-import from GSC via keyword sync
2. Manual CSV import via rank tracking API
3. Missing dates remain null — never backfilled with zero

## Data export for migration

| Data | Endpoint |
|------|----------|
| Keywords | `GET /api/brands/{brandId}/seo/keywords?export=true` |
| Crawl issues | Via site issues API |
| Briefs | `GET /api/brands/{brandId}/seo/briefs` |

## Retention policy

- Active sites: indefinite retention
- Archived brands: cascade delete on archival
- AI usage records: retained for billing audit
- Crawl snapshots: latest per page + historical per run

## Verification after recovery

- [ ] Site verification status correct
- [ ] Latest crawl run COMPLETED
- [ ] Keyword count matches expected
- [ ] Brief/long-form versions accessible
- [ ] Rank observations have correct date range
