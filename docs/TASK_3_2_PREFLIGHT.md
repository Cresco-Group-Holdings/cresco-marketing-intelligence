# Task 3.2 Pre-Flight Audit — First-Party Website Analytics

Date: 2026-07-30  
Base branch: `cursor/marketing-data-warehouse-e94c` (Task 3.1)

## Reusable from Task 3.1

| Asset | Reuse |
| --- | --- |
| `MarketingEvent`, `MarketingSession`, `MarketingIdentity` | Canonical storage for tracked events and sessions |
| `MarketingConversionDefinition` | Maps product conversions to event names |
| `marketing-warehouse-ingestion-service` | Optional raw-record path for batch replay |
| `marketing-warehouse-normalisation-service` | `FIRST_PARTY` stub normaliser for warehouse batches |
| `marketingData.*` permissions | Extended with `tracking.*` for debugger UI |
| `withApiHandler` + `warehouse-handler` patterns | Dashboard APIs |
| `checkRateLimit` | Per-property public ingest rate limiting |
| `applySecurityHeaders` | CSP updated to allow first-party tracking script |

## Gaps addressed in 3.2

| Gap | Resolution |
| --- | --- |
| No browser SDK | `public/tracking/cresco-track.js` |
| No public ingest API | `POST /api/tracking/v1/events` |
| No tracking property model | `TrackingProperty`, `TrackingDomain`, etc. |
| No consent for analytics | SDK consent categories + server-side gating |
| No bot filtering | Deterministic quarantine in ingest service |
| No server-side conversion API | `POST /api/tracking/v1/server-events` with API key HMAC |
| No tracking UI | `/data/tracking/*` debugger and install pages |
| Session fields incomplete | Extended `MarketingSession` with counts and consent |

## MarketingEvent / MarketingSession review

- Events use `provider = FIRST_PARTY`, `source = FIRST_PARTY`
- Idempotency via `idempotencyKey` and `@@unique([brandId, provider, providerEventId])`
- Sessions keyed by `@@unique([brandId, provider, providerSessionId])`
- No email in browser payloads — identity uses `ANONYMOUS_ID` and `USER_ID` only when server-confirmed

## Tenant resolution

Browser sends **only** `publicPropertyId`. Organisation, project, and brand are resolved server-side from `TrackingProperty`. Tenant IDs from the client are rejected.

## Consent architecture

Leads domain has `LeadConsent` (separate). Analytics consent is SDK-side categories (`ESSENTIAL`, `ANALYTICS`, `MARKETING`, `PERSONALISATION`) propagated in event metadata. Not legal advice.

## Background jobs

Tracking ingest is synchronous (low-latency). Warehouse batch scheduling remains deferred. Quarantined events are stored in `TrackingIngestLog`, not deleted.

## Rate limiting

In-memory `checkRateLimit` per `propertyId:clientIp` on public endpoint. Documented limitation: edge Redis deferred.

## CSP

Tracking script served from same origin (`/tracking/cresco-track.js`). Public ingest posts to `/api/tracking/v1/events` on same origin (first-party). Customer sites load script from Cresco app URL or self-host snippet pointing at Cresco collector.

## Migration risks

- New tables only; `MarketingSession` column additions are nullable/defaulted
- No rewrite of Stage 1/2 modules

## Deferred technical debt

- Edge rate limiting (Redis)
- Real-time websocket debugger
- GeoIP database integration
- Automated domain DNS verification cron

## Initial Cresco properties (seed via admin API, not auto-production)

| Property | Domains |
| --- | --- |
| Cresco Group | crescogroup.uk |
| Cresco Grants marketing | crescogrants.com |
| Cresco Grants app | app.crescogrants.com |
| Capital Cresco marketing | capitalcresco.com |
| Capital Cresco app | app.capitalcresco.com |
