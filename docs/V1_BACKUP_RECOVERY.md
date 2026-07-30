# V1 Backup and Recovery

Backup, point-in-time recovery (PITR), and rollback procedures for V1 production.

## Assumptions

PostgreSQL is hosted on a managed provider (e.g. Supabase, Neon, RDS) with:

- Automated daily backups
- Point-in-time recovery (PITR) where available
- Minimum 7-day retention (adjust per compliance requirements)

Object storage (marketing assets, email attachments) uses provider versioning.

## Backup policy

| Data | Method | Frequency | Retention |
|------|--------|-----------|-----------|
| PostgreSQL | Provider automated backup | Daily | Per provider plan (min 7 days) |
| PostgreSQL PITR | Provider WAL archiving | Continuous | Per provider plan |
| Marketing assets | Object storage versioning | Per upload | Per bucket policy |
| Email provider data | Provider retention | Varies | Not replicated in platform |
| Environment config | Vercel env export (encrypted) | On change | Manual archive |
| Audit logs | Database table | Continuous | 12 months recommended |

## Pre-migration backup

Before every production migration:

1. Confirm latest automated backup completed successfully.
2. Note backup timestamp in deployment log.
3. For high-risk migrations (Stage 6 CRM/email tables), take a manual snapshot.
4. Run `npm run validate:migrations` in CI before deploy.

Current migration count: **59 migrations** (validated).

## Recovery procedures

### Database restore (full)

1. Identify recovery point (timestamp before incident).
2. Use provider console to restore to new database instance or PITR.
3. Update `DATABASE_URL` and `DIRECT_URL` in Vercel (if instance changed).
4. Run `GET /api/readiness` to verify connectivity.
5. Redeploy application if schema mismatch detected.
6. Verify tenant isolation with smoke tests (see `V1_RELEASE_CHECKLIST.md`).

### Database restore (partial tenant)

1. Restore backup to isolated staging instance.
2. Export affected tenant data (CRM, email, automation records).
3. Import via controlled scripts with organisationId validation.
4. Verify tenant isolation after import — no cross-tenant data leakage.
5. Reconcile email suppression lists post-import.

### Asset storage restore

1. Use storage provider versioning to restore affected objects.
2. Reconcile `MarketingAsset` records if metadata was lost.
3. Verify signed URL generation for restored assets.

### Email provider recovery

Email delivery state (bounces, complaints) may not be fully recoverable from platform DB alone:

1. Re-sync suppression lists from email provider dashboard.
2. Replay webhooks if provider supports event replay.
3. Verify `EmailSuppression` table matches provider state.

### Connector credential recovery

If `ENCRYPTION_KEY` rotation required:

1. **Do not rotate blindly** — requires planned re-encryption of all connector credentials.
2. Disconnect and reconnect affected providers per tenant.
3. Verify OAuth tokens refresh successfully.

## Connection pooling

For serverless (Vercel):

- Use pooled connection string for `DATABASE_URL` (e.g. Supabase pooler port 6543)
- Use direct connection for `DIRECT_URL` (migrations only)
- Limit concurrent Prisma connections via provider settings

## Recovery testing

| Test | Frequency | Owner |
|------|-----------|-------|
| Backup restore to staging | Quarterly | Infrastructure |
| PITR point verification | Quarterly | Infrastructure |
| Asset versioning restore | Annually | Infrastructure |
| Documented restore duration | Per test | Engineering |

Record restore duration and any data gap in test log.

## Seed restrictions

`npm run db:seed:development` is blocked in production unless `ALLOW_DEV_SEED=true` is explicitly set. **Never enable in production.**

## RTO / RPO targets (recommended)

| Metric | Target | Notes |
|--------|--------|-------|
| RPO (data loss) | < 1 hour | With PITR enabled |
| RTO (recovery time) | < 4 hours | Full database restore |
| RTO (application rollback) | < 15 minutes | Vercel promote previous deployment |

## Related documents

- `docs/V1_ROLLBACK_PLAN.md` — application rollback
- `docs/V1_INCIDENT_RESPONSE.md` — incident procedures
- `docs/BACKUP_RECOVERY.md` — Stage 1 baseline (superseded by this doc for V1)
- `docs/SEO_DATA_RECOVERY_RUNBOOK.md` — SEO-specific recovery
- `docs/AD_MUTATION_RECOVERY.md` — advertising mutation recovery
