# Rollback Procedure

## Principles

1. Prefer **forward fixes** (new migration + redeploy) over schema rollback.
2. Never rollback database migrations automatically in production.
3. Keep rollback scope limited to application deployment where possible.

## Application rollback (Vercel)

1. Open the Vercel project → Deployments.
2. Identify the last known-good production deployment.
3. Click **Promote to Production** on that deployment.
4. Verify:
   - `GET /api/health` → `200`
   - `GET /api/readiness` → `200`
   - Login flow works
5. Monitor error logs for 30 minutes.

## Database rollback

Prisma does not support automatic down migrations in production.

If a migration caused issues:

1. **Stop** further deploys.
2. Assess whether a forward migration can fix the schema safely.
3. If data repair is required, restore from backup (see `docs/BACKUP_RECOVERY.md`).
4. Document the incident in the post-mortem template.

## Configuration rollback

1. Revert environment variables in Vercel to previous values.
2. Redeploy or wait for next deployment to pick up changes.
3. Verify OAuth redirect URLs match `APP_URL`.

## When NOT to rollback

- Security patch already deployed — fix forward instead
- Migration already applied with dependent data changes
- Rollback would expose previously fixed vulnerability

## Communication

Follow `docs/INCIDENT_RESPONSE.md` for stakeholder notification.
