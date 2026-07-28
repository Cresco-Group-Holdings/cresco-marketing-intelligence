# Backup and Recovery

## Assumptions

Stage 1 assumes PostgreSQL is hosted on a managed provider (e.g. Supabase, Neon, RDS) with:

- Automated daily backups
- Point-in-time recovery (PITR) where available
- Minimum 7-day retention (adjust per compliance requirements)

## Backup policy

| Data | Method | Frequency | Retention |
|------|--------|-----------|-----------|
| PostgreSQL | Provider automated backup | Daily | Per provider plan |
| PostgreSQL PITR | Provider WAL archiving | Continuous | Per provider plan |
| Marketing assets | Object storage versioning | Per upload | Per bucket policy |
| Environment config | Vercel env export (encrypted) | On change | Manual archive |

## Pre-migration backup

Before every production migration:

1. Confirm latest automated backup completed successfully.
2. Note backup timestamp in deployment log.
3. For high-risk migrations, take a manual snapshot.

## Recovery procedure

### Database restore

1. Identify recovery point (timestamp before incident).
2. Use provider console to restore to new database instance or PITR.
3. Update `DATABASE_URL` and `DIRECT_URL` in Vercel (if instance changed).
4. Run `GET /api/readiness` to verify connectivity.
5. Redeploy application if needed.

### Asset storage restore

1. Use storage provider versioning to restore affected objects.
2. Reconcile `MarketingAsset` records if metadata was lost.

### Partial data loss

1. Export affected tenant data from backup instance.
2. Import via controlled scripts (not automated in Stage 1).
3. Verify tenant isolation after import.

## Connection pooling

For serverless (Vercel):

- Use pooled connection string for `DATABASE_URL` (e.g. Supabase pooler port 6543)
- Use direct connection for `DIRECT_URL` (migrations only)
- Limit concurrent Prisma connections via provider settings

## Testing recovery

- Quarterly: verify backup restore to staging environment
- Document restore duration and any data gap

## Seed restrictions

`npm run db:seed:development` is blocked in production unless `ALLOW_DEV_SEED=true` is explicitly set. Never enable in production.
