# Stage 4 Rollback Plan

## Immediate shutdown (no deploy)

```bash
# Disable all SEO crawls
SEO_ENGINE_EMERGENCY_SHUTDOWN=true

# Disable SEO AI generation (briefs, long-form, on-page AI, etc.)
SEO_AI_EMERGENCY_SHUTDOWN=true
```

Restart application processes after setting environment variables.

## Application rollback

1. Identify last known-good deployment tag
2. Run database migration rollback only if migration is reversible (Stage 4 migrations are additive — prefer forward fix)
3. Deploy previous application version
4. Verify `/api/readiness` returns `ready`
5. Confirm crawls are not enqueueing (check `SEO_ENGINE_EMERGENCY_SHUTDOWN`)

## Database rollback

Stage 4 migrations are **additive** (new tables/enums). Rollback strategy:

1. **Preferred:** Fix forward — patch application, keep schema
2. **If required:** Drop Stage 4 tables in reverse migration order (4.9 → 4.1)
3. Never drop tables with production data without backup

### Backup before rollback

```bash
pg_dump $DATABASE_URL > stage4_backup_$(date +%Y%m%d).sql
```

## Feature-level rollback

| Feature | Disable method |
|---------|---------------|
| Crawls | `SEO_ENGINE_EMERGENCY_SHUTDOWN=true` |
| SEO AI | `SEO_AI_EMERGENCY_SHUTDOWN=true` |
| Competitor crawl | Reduce `maxCompetitorCrawlsPerDay` to 0 via quota override |
| Rank tracking | Pause projects via UI or set status ARCHIVED |
| Internal link builds | Stop via API; no background worker |

## Communication

1. Notify affected customers of degraded SEO features
2. Document incident in `SEO_INCIDENT_RESPONSE.md` template
3. Post-mortem within 48 hours for SEV-1/SEV-2

## Recovery verification

- [ ] `/api/readiness` passes
- [ ] Test crawl on staging site succeeds
- [ ] Tenant isolation test passes
- [ ] AI generation works with test prompt
- [ ] No elevated `crawl_failures` or `ssrf_attempts`
