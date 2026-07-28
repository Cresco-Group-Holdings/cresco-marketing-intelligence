# Stage 1 Release Checklist

Use this checklist before promoting a Stage 1 build to production.

## Pre-release

- [ ] All Pull Request CI jobs pass on the release branch
- [ ] `npm run lint` passes locally
- [ ] `npm run typecheck` passes locally
- [ ] `npm run test:unit` passes locally
- [ ] `npm run test:integration` passes locally
- [ ] `npm run build` passes locally
- [ ] `npm run validate:prisma` passes
- [ ] `npm run validate:migrations` passes
- [ ] `npm run audit:secrets` passes
- [ ] `npm run audit:deps` reviewed (no unresolved high/critical)
- [ ] `npm run test:e2e:foundation` passes (with `ALLOW_TEST_AUTH=true` if applicable)

## Environment

- [ ] Production database provisioned and isolated from preview/dev
- [ ] Production Supabase project configured (or documented shared-project isolation)
- [ ] `APP_URL` set to production canonical URL
- [ ] OAuth redirect URLs updated in Supabase and provider consoles
- [ ] Unique `ENCRYPTION_KEY` generated for production
- [ ] `ALLOW_TEST_AUTH` unset or `false` in production
- [ ] `ALLOW_AI_DIAGNOSTICS` unset or `false` unless explicitly approved
- [ ] `ALLOW_DEV_SEED` unset in production
- [ ] Marketing asset storage bucket configured for production

## Database

- [ ] Backup taken before migration (see `docs/BACKUP_RECOVERY.md`)
- [ ] `npm run db:migrate:deploy` executed against production
- [ ] Migration success verified in deployment logs
- [ ] Connector definitions seeded via migration

## Deployment (Vercel)

- [ ] Preview deployment smoke-tested
- [ ] Production deployment created (manual promotion)
- [ ] `GET /api/health` returns `200`
- [ ] `GET /api/readiness` returns `200` with database check passing
- [ ] Auth login/logout/callback verified on production URL
- [ ] CSP headers present (no console CSP violations on core flows)

## Functional validation

- [ ] User can sign up and verify email
- [ ] User can create organisation, project, and brand
- [ ] Brand Knowledge Base readiness updates on dashboard
- [ ] Marketing asset upload works with approval metadata
- [ ] Marketing objectives appear on dashboard
- [ ] Brand switching updates dashboard context
- [ ] Team invitation flow works end-to-end
- [ ] Viewer role cannot modify protected resources
- [ ] Connector catalogue shows unavailable (not operational) state
- [ ] Dashboard shows real readiness — no fabricated metrics
- [ ] Cross-tenant access attempts return 403/404

## Post-release

- [ ] Monitor logs for error spikes (first 24 hours)
- [ ] Verify readiness endpoint in uptime monitoring
- [ ] Record release version and migration ID in change log
- [ ] Keep rollback plan accessible (`docs/ROLLBACK.md`)

## Launch decision

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | |
| Security | | | |
| Product | | | |
