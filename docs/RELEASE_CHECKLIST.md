# Production Release Checklist

## Pre-deploy
- [ ] All CI checks green (lint, typecheck, unit, integration, build)
- [ ] `npm run validate:rls-security` passed
- [ ] Prisma migrations reviewed (no unapproved destructive changes)
- [ ] Database backup confirmed
- [ ] Environment variables validated (`validateEnvironmentOnStartup`)
- [ ] `ALLOW_TEST_AUTH` is **not** set in production

## Deploy
- [ ] Run migrations (`prisma migrate deploy`)
- [ ] Deploy application
- [ ] Verify `/api/health` and `/api/readiness`

## Post-deploy smoke
- [ ] Login / logout
- [ ] Command Centre loads
- [ ] Provider OAuth initiation (one provider)
- [ ] Stripe webhook test event (staging)
- [ ] Worker health visible in Operations

## Rollback
- Application: redeploy previous release tag
- Database: prefer roll-forward migration; see `DATABASE_RESTORE.md` for restore
