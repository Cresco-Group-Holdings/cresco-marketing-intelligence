# Production Database Migration Runbook

This runbook describes how to apply committed Prisma migrations to the **existing Supabase production PostgreSQL database** for Cresco Marketing Intelligence.

This workflow does **not** use Prisma Cloud, Prisma Postgres, Accelerate, Data Proxy, or Prisma API keys. Supabase remains the source of truth.

## Prerequisites

- GitHub admin access to `romanpavlenkolondon-glitch/cresco-marketing-intelligence`
- Supabase production **direct/session** PostgreSQL connection string (port `5432` or supported Supabase pooler direct port)
- Permission to approve the protected `production` GitHub Environment

## One-time setup

### 1. Create the protected GitHub Environment

1. Open the GitHub repository.
2. Go to **Settings** → **Environments**.
3. Click **New environment**.
4. Name it exactly: `production`
5. Enable **Required reviewers** and add at least one approver.
6. Save the environment.

### 2. Add the production database secret

1. Go to **Settings** → **Secrets and variables** → **Actions**.
2. Open the **Environment secrets** tab for `production`.
3. Add a new secret:
   - **Name:** `PRODUCTION_DIRECT_URL`
   - **Value:** Supabase production direct/session PostgreSQL connection string

Do not commit this value. Do not paste it into issues, PRs, or logs.

The workflow uses this secret for both `DATABASE_URL` and `DIRECT_URL` inside the isolated migration job only.

## Running a production migration

1. Merge any pending migration changes to `main`.
2. Go to **Actions** → **Production Database Migrate**.
3. Click **Run workflow**.
4. In the `confirmation` field, enter exactly:

   ```text
   MIGRATE_PRODUCTION
   ```

5. Start the workflow.
6. Approve the pending `production` environment deployment when prompted.
7. Review the workflow summary and job logs.

## What the workflow does

The workflow is **manual only** (`workflow_dispatch`) and:

1. Checks out the latest `main` branch
2. Installs dependencies with `npm ci`
3. Runs `npx prisma validate`
4. Runs `npx prisma migrate status` (before)
5. Runs `npx prisma migrate deploy`
6. Runs `npx prisma migrate status` (after)
7. Runs `npx prisma generate`
8. Runs `node scripts/verify-production-migration.mjs`

It does **not** run:

- `prisma migrate dev`
- `prisma migrate reset`
- `prisma db push`
- `prisma migrate resolve`

## Verification output

After deploy, the verification step reports only:

- repository migration count
- applied migration count
- pending migration count
- failed migration count
- latest applied migration
- representative table existence for:
  - `_prisma_migrations`
  - `UserProfile`
  - `SecurityAuditLog`
  - `Organisation`
  - `ProviderConnection`
  - `ProviderCredential`
  - `ProviderOutboundSend`

No table contents or connection strings are printed.

## Safety checks before approving

Confirm all of the following before approving the `production` environment:

- You intend to migrate the **production Supabase** database, not preview or local.
- `main` contains the migrations you expect.
- `prisma migrate status` in the workflow log shows pending migrations only (no failed migrations).
- If `20250728110000_task_1_3_auth` is already marked applied but `SecurityAuditLog` is missing, **stop** and investigate schema drift. Do not rerun blindly.

## Post-migration checks

1. Confirm the workflow completed successfully.
2. Confirm verification reports `pendingMigrationCount: 0` and `failedMigrationCount: 0`.
3. Confirm `SecurityAuditLog` exists.
4. Run a controlled login attempt and confirm invalid credentials return HTTP `401`, not HTTP `500`.
5. Signup remains a separate Supabase Auth concern; migration success alone does not prove signup is fixed.

## Rollback

Prisma `migrate deploy` is forward-only. If a migration causes problems:

1. Stop further deploys.
2. Assess impact with engineering.
3. Prepare a corrective forward migration on `main` rather than resetting production.

Never run `prisma migrate reset` against production.

## Related documentation

- `docs/DEPLOYMENT.md`
- `docs/V1_OPERATIONS_RUNBOOK.md`
- `docs/V1_RELEASE_CHECKLIST.md`
