# API Middleware Security

## Principle

Middleware exemption only means **do not require a browser session at the middleware layer**.

It must **never** mean **trust this request**.

Every session-exempt endpoint enforces its own security boundary in the route handler:

| Class | Handler boundary |
| --- | --- |
| `WEBHOOK` | Provider cryptographic signature verification |
| `OAUTH_CALLBACK` | Signed state / PKCE / persisted OAuth transaction |
| `WORKER_INTERNAL` | `PUBLISHING_WORKER_TOKEN` bearer token |
| `CRON_INTERNAL` | `CRON_SECRET` bearer token |
| `TOKEN_PUBLIC` | Opaque share token or tracking API key + signature |
| `TRACKING_PUBLIC` | Schema validation + rate limiting |
| `PUBLIC_WEB` | Public auth endpoints with rate limiting where applicable |

## Classification source of truth

- `src/lib/security/api-route-classification.ts`
- `src/lib/auth/routes.ts`

CI inventory test: `tests/unit/api-route-classification.test.ts`

## Session-exempt API families

| Prefix / path | Class |
| --- | --- |
| `/api/webhooks/*` | `WEBHOOK` |
| `/api/connectors/oauth/*`, `/api/social/oauth/callback` | `OAUTH_CALLBACK` |
| `/api/publishing-scheduler/*`, `/api/publishing-jobs/*`, `/api/social-analytics-sync/*`, `/api/seo-crawl/*`, `/api/notifications/digest/*`, `/api/social-reports/process-due` | `WORKER_INTERNAL` |
| `/api/publishing-scheduler/process-due` | `CRON_INTERNAL` |
| `/api/reports/shared/*`, `/api/tracking/v1/server-events` | `TOKEN_PUBLIC` |
| `/api/tracking/v1/events`, `/api/forms/v1/*/submit` | `TRACKING_PUBLIC` |
| `/api/health`, `/api/readiness`, `/api/auth/*` | `PUBLIC_WEB` |
| All other `/api/*` routes | `AUTHENTICATED` / `PERMISSIONED` at handler |

## Shared reports

Decision: **LAUNCH-ENABLED**

- Share tokens are 24-byte cryptographically random hex strings.
- Middleware allows `/api/reports/shared/[token]` and `/reports/shared/[token]` without a session.
- Handler resolves tenant ownership from persisted `shareToken` only.
- Response is minimised via `serializeSharedReport()` and excludes internal IDs, billing, credentials, and membership data.
- Invalid/expired/revoked tokens return controlled `NOT_FOUND` / `FORBIDDEN` responses.
- Rate limiting: 30 requests/minute/IP on the shared report API route.

## Boundary tests

Sibling routes must not become public accidentally:

- `/api/webhooks/meta` → session exempt
- `/api/providers/connections` → session required
- `/api/reports/shared/token` → session exempt
- `/api/reports` → session required

## Regression suite

`tests/unit/api-middleware-security.test.ts` covers:

- Public vs protected pages and APIs
- Webhook signature acceptance/rejection
- Stripe webhook contract
- Worker/cron token auth
- Shared report token entropy and minimisation
- Tracking public vs protected APIs
- Open redirect regression

Run:

```bash
npm run test:unit -- tests/unit/api-middleware-security.test.ts tests/unit/api-route-classification.test.ts tests/unit/routes.test.ts
node scripts/validate-api-security-classification.mjs
```
