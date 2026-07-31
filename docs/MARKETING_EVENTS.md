# Marketing Events

The warehouse event layer captures behavioural, conversion, and session data from first-party tracking, manual import, and (future) connector ingest. Events complement metric observations for funnel, attribution, and identity analysis.

## Scope in Task 3.1

| Source | Status |
| --- | --- |
| `FIRST_PARTY` | Schema + API ingestion path active |
| `MANUAL_IMPORT` | CSV event rows supported |
| `SOCIAL` | Not event-sourced in 3.1 (metrics only via bridge) |
| `CONNECTOR` | GA4/event connectors stubbed — no live sync |

## Core models

| Model | Purpose |
| --- | --- |
| `MarketingEvent` | Named occurrence with timestamp and properties |
| `MarketingEventProperty` | Normalised key-value attributes |
| `MarketingSession` | Visit session with UTM and device context |
| `MarketingIdentity` | Typed user identifier |
| `MarketingIdentityLink` | Identity graph edge |
| `MarketingConversionDefinition` | Goal/transaction/lead definitions |

## Event model

`MarketingEvent`:

| Field | Purpose |
| --- | --- |
| `provider` | `MarketingDataProvider` |
| `source` | `CONNECTOR`, `FIRST_PARTY`, `MANUAL_IMPORT`, `SOCIAL` |
| `providerEventId` | Stable provider identifier |
| `eventName` | Canonical event name (`page_view`, `purchase`, `form_submit`, …) |
| `occurredAt` | Event timestamp (UTC) |
| `sessionId` | Optional `MarketingSession` FK |
| `identityId` | Optional `MarketingIdentity` FK |
| `marketingCampaignId` | Optional campaign attribution |
| `properties` | JSON blob for unstructured attributes |
| `idempotencyKey` | Deduplication key |

Unique constraint: `[brandId, provider, providerEventId]`.

### Event properties

Structured properties are normalised into `MarketingEventProperty` rows for indexed query:

| Field | Purpose |
| --- | --- |
| `propertyKey` | Attribute name |
| `propertyValue` | String value (typed via `propertyType`) |
| `propertyType` | `string`, `number`, `boolean`, `date` |

High-cardinality properties remain in `properties` JSON only.

## Sessions

`MarketingSession` groups events within a visit:

| Field | Purpose |
| --- | --- |
| `providerSessionId` | Provider or first-party session ID |
| `startedAt` / `endedAt` | Session boundaries |
| `landingPage` | Entry URL path |
| `referrer` | HTTP referrer |
| `utmSource` / `utmMedium` / `utmCampaign` / `utmTerm` / `utmContent` | Campaign parameters |
| `deviceCategory` | `desktop`, `mobile`, `tablet` |
| `country` | ISO country code |

Sessions feed channel classification (`docs/CHANNEL_TAXONOMY.md`).

## Identity

`MarketingIdentity` stores typed identifiers:

`MarketingIdentityType`: `ANONYMOUS_ID`, `USER_ID`, `EMAIL`, `PHONE`, `DEVICE_ID`, `COOKIE_ID`, `PROVIDER_ID`.

Unique constraint: `[brandId, identityType, identityValue]`.

### Identity links

`MarketingIdentityLink` connects identities with a confirmation workflow:

| Status | Meaning |
| --- | --- |
| `PENDING` | Proposed link, awaiting confirmation |
| `CONFIRMED` | Operator or system confirmed |
| `REJECTED` | Link rejected |
| `EXPIRED` | Confirmation window elapsed |

Probabilistic identity resolution is **out of scope** for 3.1. Links are created only via explicit import, first-party `identify` calls, or operator action.

## Conversions

`MarketingConversionDefinition` defines measurable goals:

`MarketingConversionType`: `GOAL`, `TRANSACTION`, `LEAD`, `SIGNUP`, `CUSTOM`.

Conversion events reference definitions by `conversionKey` in event properties or via normaliser mapping.

## First-party ingestion

Server-side event API (brand-scoped):

```
POST /api/brands/[brandId]/marketing-data/events
```

Payload (validated via Zod):

```json
{
  "eventName": "page_view",
  "occurredAt": "2026-07-30T08:00:00.000Z",
  "sessionId": "sess_abc123",
  "identity": { "type": "ANONYMOUS_ID", "value": "anon_xyz" },
  "properties": { "page": "/pricing", "title": "Pricing" },
  "utm": { "source": "google", "medium": "cpc", "campaign": "brand" }
}
```

- `provider = FIRST_PARTY`, `source = FIRST_PARTY`
- Session upserted if `sessionId` provided
- Identity upserted if `identity` provided
- Permission: `marketingData.import` or dedicated first-party write key (future)

## Manual import events

CSV import supports `record_type = event` rows. Required columns:

| Column | Required | Notes |
| --- | --- | --- |
| `event_name` | Yes | Canonical name |
| `occurred_at` | Yes | ISO 8601 |
| `provider_event_id` | Yes | Stable dedup ID |
| `session_id` | No | Links to session |
| `property_*` | No | Mapped via `ManualImportMapping` |

## GA4 / connector events (deferred)

GA4 and other analytics connectors will map `NormalisedEvent` (from `docs/NORMALISED_MARKETING_DATA.md`) into `MarketingEvent` during connector ingest (Task 3.2+). The stub normaliser accepts test fixtures but rejects live GA4 payloads with `provider_not_active`.

## Privacy and PII

- `EMAIL` and `PHONE` identity types may contain PII — subject to `docs/AI_PRIVACY.md` and brand data policies
- Event properties must not contain passwords, tokens, or payment card numbers
- Raw event payloads in import files are validated and redacted in logs
- Identity link confirmation requires `marketingData.manage`

## Timezone

Event timestamps are stored in UTC. Session date bucketing for reporting uses brand analytics timezone (same resolution order as `docs/SOCIAL_ANALYTICS.md`).

## Related documentation

- `docs/MARKETING_DATA_MODEL.md` — entity relationships
- `docs/CHANNEL_TAXONOMY.md` — UTM-based channel classification
- `docs/DATA_LINEAGE.md` — event provenance
- `docs/MANUAL_IMPORT.md` — CSV event import
- `docs/NORMALISED_MARKETING_DATA.md` — `NormalisedEvent` type
