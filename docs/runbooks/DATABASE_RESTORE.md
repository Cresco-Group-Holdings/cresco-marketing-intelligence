# Runbook — Database Restore

## Policy
- **RPO:** Up to 24 hours (provider backup frequency)
- **RTO:** Target 4 hours for full restore

## Procedure (non-production validation)
1. Identify backup snapshot from Supabase dashboard
2. Restore to isolated staging project — never overwrite production directly without approval
3. Update `DATABASE_URL` in staging only
4. Run `npx prisma migrate deploy`
5. Verify tenant isolation: run `npm run test:database` against staging
6. Record restore duration and issues

## Production restore
Requires explicit approval. Prefer roll-forward for schema migrations.

## Evidence
Document backup ID, restore timestamp, and validation results in release notes.
