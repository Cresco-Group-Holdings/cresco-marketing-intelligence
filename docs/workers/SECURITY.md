# Worker Security

## Machine authentication

Worker endpoints authenticate with:

- `WORKER_TOKEN` (preferred) or `PUBLISHING_WORKER_TOKEN`
- `CRON_SECRET` for scheduler/dispatch routes (Vercel Cron)

Validation uses timing-safe comparison (`src/lib/api/worker-auth.ts`). Unauthenticated execution is impossible when tokens are configured.

## Middleware

Worker API prefixes are exempt from Supabase session auth in `src/lib/auth/routes.ts`:

- `/api/workers/`
- `/api/cron/`
- legacy feature `process-due` routes

## Tenant isolation

- Every `WorkerJob` carries `organisationId`.
- Handlers verify `domainRefId` belongs to the same organisation.
- Workers run as system authority with auditable actor context where needed — they do not impersonate user cookies.

## Secrets

- Never log tokens, payloads with credentials, or provider responses containing secrets.
- Scheduler workflows use only `APP_URL` + worker token secrets.

## Rate limiting

Provider rate limits are respected via handler outcomes (`RATE_LIMITED`) and existing provider execution policy. Workers do not immediately retry 429 responses.
