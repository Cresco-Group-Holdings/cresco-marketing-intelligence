# Environment configuration

Cresco Marketing Intelligence uses typed environment validation in `src/lib/environment/index.ts`. Missing required values produce clear startup errors.

## Required variables

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Server only | Prisma connection string |
| `DIRECT_URL` | Server only | Direct PostgreSQL connection for migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged Supabase operations |
| `APP_URL` | Server only | Canonical application URL |
| `ENCRYPTION_KEY` | Server only | Application-level encryption (min 32 chars) |

## Optional integration variables

These may be omitted during local development. The environment module reports whether each integration is configured.

| Variable | Exposure | Integration |
| --- | --- | --- |
| `OPENAI_API_KEY` | Server only | OpenAI |
| `ANTHROPIC_API_KEY` | Server only | Anthropic |
| `GOOGLE_CLIENT_ID` | Server only | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Server only | Google OAuth |
| `META_APP_ID` | Server only | Meta OAuth |
| `META_APP_SECRET` | Server only | Meta OAuth |
| `PUBLISHING_WORKER_TOKEN` | Server only | Bearer token for publishing worker and manual scheduler invocations. The endpoint rejects every request when unset. |
| `CRON_SECRET` | Server only | Vercel Cron bearer secret. Vercel injects `Authorization: Bearer <CRON_SECRET>` on cron requests when set. Required for production publishing schedule. |
| `TIKTOK_CLIENT_KEY` | Server only | TikTok OAuth |
| `TIKTOK_CLIENT_SECRET` | Server only | TikTok OAuth |
| `LINKEDIN_CLIENT_ID` | Server only | LinkedIn OAuth |
| `LINKEDIN_CLIENT_SECRET` | Server only | LinkedIn OAuth |
| `X_CLIENT_ID` | Server only | X OAuth |
| `X_CLIENT_SECRET` | Server only | X OAuth |

## Social analytics synchronisation variables

All values are optional and fall back to production-safe defaults. They are read on each call, so a
deployment can change cadence without a rebuild.

| Variable | Default | Purpose |
| --- | --- | --- |
| `SOCIAL_ANALYTICS_SYNC_ENABLED` | `true` | Set to `false` to stop the scheduler enqueuing new recurring syncs. Manual syncs still work. |
| `SOCIAL_ANALYTICS_SYNC_INTERVAL_MINUTES` | `360` | Scheduling window. Repeated scheduler runs inside one window collapse onto a single job per account. Clamped to 15–10080. |
| `SOCIAL_ANALYTICS_SYNC_LEASE_SECONDS` | `300` | Worker lease duration. A `RUNNING` sync whose lease expires is reclaimable by another worker. Clamped to 30–3600. |
| `SOCIAL_ANALYTICS_SYNC_RETRY_SECONDS` | `60` | Backoff applied after a rate limit or partial failure. Clamped to 5–3600. |
| `SOCIAL_ANALYTICS_BACKFILL_DAYS` | `90` | Historical window requested from providers that expose post history. Clamped to 1–730. |
| `SOCIAL_ANALYTICS_BACKFILL_MAX_PAGES` | `20` | Provider history pages walked per worker pass. Remaining pages resume from the persisted cursor. Clamped to 1–200. |
| `SOCIAL_ANALYTICS_SCHEDULER_BATCH` | `100` | Maximum accounts considered per scheduler run. Clamped to 1–1000. |
| `SOCIAL_ANALYTICS_WORKER_BATCH` | `10` | Maximum syncs drained per worker invocation. Clamped to 1–50. |

The analytics worker and scheduler endpoints authenticate with `PUBLISHING_WORKER_TOKEN`.

## Test authentication variables

These are used only in automated tests and local test flows. They are not required for normal development.

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `ALLOW_TEST_AUTH` | Server only | Bypass Supabase auth in middleware and API handlers |
| `TEST_AUTH_USER_ID` | Server only | Auth user ID used for test bypass |
| `TEST_AUTH_EMAIL` | Server only | Email used when provisioning the test profile |
| `ANALYTICS_TEST_DATABASE_URL` | Server only | Connection string for the isolated PostgreSQL database used by `npm run test:database`. The suite is skipped when unset. |

Only `NEXT_PUBLIC_*` variables may be exposed to the browser.

## Local development

1. Copy `.env.example` to `.env`.
2. Fill in database and Supabase credentials.
3. Generate a 32+ character `ENCRYPTION_KEY`.
4. Run `npm install`.
5. Run `npm run db:migrate`.
6. Start the app with `npm run dev`.

Integration keys can remain blank while working on UI and tenant foundations.

## Vercel configuration

Configure the same variables in the Vercel project settings:

- Add server-only values as encrypted environment variables.
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production, Preview, and Development as needed.
- Set `APP_URL` to the deployed canonical URL for each environment.
- Use separate Supabase projects or keys per environment where possible.

Never add service role keys, AI provider keys, OAuth secrets, encryption keys, or database credentials to `NEXT_PUBLIC_*` variables.

## Validation behaviour

- Required values throw descriptive errors during startup or first access.
- Optional integrations return `configured: false` in status responses.
- Tests can reset the environment cache via `resetEnvCacheForTests()`.
