# First-Party Analytics

Cresco Marketing Intelligence includes a privacy-conscious first-party analytics system for measuring website traffic, sessions, marketing interactions, and product conversions across Cresco properties and future customer websites.

## Architecture

```
Browser SDK (cresco-track.js)
        │
        ▼
POST /api/tracking/v1/events  ──► TrackingIngestLog
        │                              │
        ▼                              ▼
MarketingSession              MarketingEvent (FIRST_PARTY)
        │                              │
        └──────────► Marketing Data Warehouse
```

Server-side conversions use `POST /api/tracking/v1/server-events` with API key + HMAC signature authentication.

## Core concepts

| Concept | Description |
|---------|-------------|
| **Tracking property** | A logical site or application (e.g. crescogroup.uk) scoped to organisation, project, and brand |
| **Tracking domain** | Verified origin allowed to send browser events |
| **Tracking installation** | SDK health record (version, last seen, status) |
| **Marketing session** | Deterministic session derived from anonymous ID, timeout, and optional user ID |
| **Marketing event** | Normalised warehouse event with idempotency key |

## Initial Cresco properties

Configure one tracking property per site:

- crescogroup.uk
- crescogrants.com
- app.crescogrants.com
- capitalcresco.com
- app.capitalcresco.com

Each property requires at least one verified domain with matching `allowedOrigin`.

## Privacy principles

- No application secrets in the browser SDK
- No probabilistic fingerprinting
- No raw email addresses in browser events
- Consent-aware event gating (ESSENTIAL, ANALYTICS, MARKETING, PERSONALISATION)
- Cookieless measurement mode available per property
- Suspected bot/spam events are quarantined, not deleted
- Tenant context is resolved server-side from the public property ID

## Dashboard

Operators manage tracking from **Data Hub → Tracking**:

- `/data/tracking` — overview and property health
- `/data/tracking/properties` — create and manage properties
- `/data/tracking/debugger` — live development events
- `/data/tracking/events` — recent ingest log
- `/data/tracking/install` — installation snippets

Raw payload access requires the `tracking.viewRaw` permission.

## Related documentation

- [Tracking SDK](./TRACKING_SDK.md)
- [Event naming](./EVENT_NAMING.md)
- [Consent tracking](./CONSENT_TRACKING.md)
- [Server-side events](./SERVER_SIDE_EVENTS.md)
- [Installation](./TRACKING_INSTALLATION.md)
- [Task 3.2 pre-flight audit](./TASK_3_2_PREFLIGHT.md)
