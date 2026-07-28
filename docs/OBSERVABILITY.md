# Observability and Alerting

## Structured logging

All server logs use JSON format via `src/lib/logging/index.ts`:

```json
{
  "level": "info",
  "message": "audit.event.recorded",
  "timestamp": "2025-07-28T12:00:00.000Z",
  "context": { "organisationId": "...", "action": "..." }
}
```

Sensitive keys are redacted automatically (password, token, secret, api_key, prompt, etc.).

## Request IDs

- Generated per API request via `createRequestId()`
- Returned in response envelope `meta.requestId`
- Set on `x-request-id` response header for health/readiness endpoints
- Included in error logs via `handleApiError`

## Error monitoring

`src/lib/observability/error-monitor.ts` provides a pluggable abstraction:

- Default: `ConsoleErrorMonitor` (structured JSON to stderr)
- Production: wire to Sentry, Datadog, or similar by implementing `ErrorMonitor`

Do not send secrets, prompts, or PII in error context.

## Health endpoints

| Endpoint | Purpose | Auth | Cache |
|----------|---------|------|-------|
| `GET /api/health` | Liveness — process is running | Public | No |
| `GET /api/readiness` | Readiness — DB, env, job system, diagnostics policy | Public | No |

Readiness returns `503` when not ready. Response contains check names and safe messages only.

## Recommended alerting

Configure external uptime monitoring (e.g. Vercel, Better Uptime, Pingdom):

| Alert | Condition | Severity |
|-------|-----------|----------|
| Health check failed | `/api/health` non-200 for 3 minutes | Critical |
| Readiness degraded | `/api/readiness` returns 503 for 5 minutes | High |
| Error rate spike | Log drain shows >10 errors/minute | High |
| Database connectivity | Readiness `database` check fails | Critical |

## Log aggregation

For production:

1. Connect Vercel log drain to your SIEM or log platform.
2. Filter on `level: "error"` for alerts.
3. Correlate using `requestId` and `organisationId` where present.

## Connector and AI diagnostics

- AI diagnostics gated by `ALLOW_AI_DIAGNOSTICS` in production
- Readiness warns if diagnostics enabled in production
- Connector OAuth errors recorded in `ConnectorError` table (tenant-scoped)

## What not to log

- Passwords, OAuth codes, refresh tokens, API keys
- Full request/response bodies from AI providers
- Unredacted marketing asset binary content
- Invitation tokens (only hashes stored)
