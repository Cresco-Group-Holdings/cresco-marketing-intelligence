# Data Migration Plan

**Audit date:** 2026-08-05  
**Migration count:** 68  
**Latest:** `20260805240000_notifications_inbox_collaboration`

## Principles

1. **Additive migrations only** in production — no destructive column drops without dual-write period
2. **Forward-fix preferred** over rollback
3. **Backup before every production migration**
4. **Migration gate** via `.github/workflows/production-database-migrate.yml`

## Pre-migration checklist

- [ ] Confirm target database is correct environment (staging vs production)
- [ ] Take database backup (PITR or manual snapshot)
- [ ] Record current migration state: `npx prisma migrate status`
- [ ] Review pending migrations in `prisma/migrations/`
- [ ] Estimate migration duration (large tables: `ProviderSyncRun`, `MarketingLead`, `Notification`)
- [ ] Schedule maintenance window if migration acquires locks > 30s
- [ ] Notify on-call and beta tenants if downtime expected

## Migration procedure

### Clean database (new environment)

```bash
npx prisma migrate deploy
npx prisma migrate status  # All 68 should be "Applied"
```

**Verified:** `npm run validate:migrations` passes (68 migrations, no gaps).

### Existing production state

```bash
# 1. Backup
pg_dump $DIRECT_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# 2. Check pending
npx prisma migrate status

# 3. Deploy
npx prisma migrate deploy

# 4. Verify
npx prisma migrate status
npm run test:database  # if prisma changed
```

### CI database tests

Triggered on `prisma/**` changes in `.github/workflows/main-branch.yml`:
- Postgres 16 service container
- `npx prisma migrate deploy`
- `npm run test:database` (5 test files)

## Recent migration themes

| Migration | Stage | Risk | Notes |
|-----------|-------|------|-------|
| `20260805240000_notifications_inbox_collaboration` | 15 | Low | New tables; no data migration |
| `20260805230000_publishing_provider_operations` | 14 | Low | Publication, PublicationAttempt |
| `20260805220000_provider_integration_platform` | 11/7 | Low | ProviderConnection extensions |
| `20260731180000_task_7_1_provider_integration_foundation` | 7 | Low | Provider foundation |
| Stage 6 CRM/email | 6 | Low | Additive CRM tables |

## Data backfills

| Migration | Backfill required | Strategy |
|-----------|-------------------|----------|
| Notifications inbox items | Optional | Created on new notification emit; no retroactive backfill in V1 |
| Provider connections | No | New connections only |
| CRM foundation | No | Empty tables on deploy |

## Index and constraint verification

- All foreign keys reference `organisationId` where applicable
- Unique constraints on idempotency keys (`Notification`, `Publication`, `ProviderSyncRun`)
- Run `npx prisma validate` before deploy — **PASS** as of audit date

## Rollback strategy

Prisma does not support automatic down migrations in production.

| Scenario | Action |
|----------|--------|
| Migration fails mid-deploy | Fix forward with new migration; restore from backup if schema corrupted |
| Application incompatible with new schema | Roll back **application** deployment (Vercel promote); DB stays at new schema if additive |
| Destructive migration needed | **Not permitted in V1** — use dual-write + deprecation period |

See `ROLLBACK_PLAN.md` for application rollback.

## Seed data

- No production seed scripts run automatically
- Development seeds (if any) must not run in production
- Beta tenant provisioning via onboarding flow only

## Post-migration verification

- [ ] `GET /api/health` → 200
- [ ] `GET /api/readiness` → 200 (database check passes)
- [ ] Login flow works
- [ ] Create/read test record in each new table (staging)
- [ ] Monitor error logs for 30 minutes

## Migration duration estimates

| Table size | Expected lock time |
|------------|-------------------|
| New tables (empty) | < 1s per migration |
| Index on large table | Variable — monitor in staging first |
| Full 68 from clean | < 2 minutes (CI database tests) |

## Contacts

- **On-call:** See `INCIDENT_RESPONSE_PLAN.md`
- **Database provider:** Supabase (production)
