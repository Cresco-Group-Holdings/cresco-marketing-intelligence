# GA4 API Capabilities Audit

> Capability audit for Task 3.3. Based on official Google documentation as of July 2026.
> Official references:
> - [Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
> - [Admin API](https://developers.google.com/analytics/devguides/config/admin/v1)
> - [Dimensions & metrics schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
> - [Quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)

## APIs used by Cresco

| API | Purpose | Base URL |
|-----|---------|----------|
| **Google Analytics Admin API v1beta** | List accounts, list properties, read property metadata | `https://analyticsadmin.googleapis.com/v1beta` |
| **Google Analytics Data API v1beta** | Run predefined reports, realtime summary, compatibility checks | `https://analyticsdata.googleapis.com/v1beta` |

Cresco does **not** expose arbitrary GA4 queries. All report requests use a fixed query definition registry with validated dimension/metric combinations.

## OAuth scopes

| Scope | Required | Purpose |
|-------|----------|---------|
| `https://www.googleapis.com/auth/analytics.readonly` | Yes | Read GA4 configuration and reporting data |

Cresco does not request `analytics.edit` or user-management scopes. Property selection and sync are read-only operations.

## Quotas (standard properties)

| Quota | Standard limit | Notes |
|-------|----------------|-------|
| Core tokens / property / day | 200,000 | Token cost varies by dimensions, metrics, date range, cardinality |
| Core tokens / property / hour | 40,000 | |
| Core concurrent requests / property | 10 | |
| Realtime tokens / property / day | 200,000 | Separate pool from core |
| Potentially thresholded requests / hour | 120 | Applies when using thresholded dimensions |

Cresco mitigations:

- Bounded default backfill (90 days)
- Daily incremental sync (yesterday + reconciliation window)
- Predefined low-cardinality report definitions
- `returnPropertyQuota: true` on report requests
- Exponential backoff on 429 / quota errors
- Idempotent imports to allow safe retries

## Supported import dimensions

Only dimensions from the query registry are imported:

| Dimension | API name | Reports |
|-----------|----------|---------|
| Date | `date` | All daily reports |
| Session source | `sessionSource` | Channel, landing page |
| Session medium | `sessionMedium` | Channel, landing page |
| Campaign | `sessionCampaignName` | Channel |
| Landing page | `landingPagePlusQueryString` | Landing page |
| Page path | `pagePath` | Page performance |
| Device category | `deviceCategory` | Device breakdown |
| Country | `country` | Geo breakdown |

## Supported import metrics

Only metrics actually returned by GA4 are stored. Configured mappings:

| Metric | API name | Canonical key |
|--------|----------|---------------|
| Users | `totalUsers` | `users` |
| Active users | `activeUsers` | `active_users` |
| New users | `newUsers` | `new_users` |
| Sessions | `sessions` | `sessions` |
| Engaged sessions | `engagedSessions` | `engaged_sessions` |
| Engagement rate | `engagementRate` | `engagement_rate` |
| Views | `screenPageViews` | `pageviews` |
| Event count | `eventCount` | `events` |
| Key events | `keyEvents` | `conversions` |
| Revenue | `purchaseRevenue` | `revenue` |

Metrics not configured on a property (e.g. ecommerce revenue without purchase events) are omitted from normalised output.

## Data retention limitations

GA4 property data retention is configured in the GA4 UI (2–14 months for event-level data depending on settings). The Data API can only return data within the property's retention window. Cresco backfill defaults respect this by capping at 90 days and surfacing retention metadata from the Admin API when available.

## Attribution limitations

- GA4 uses data-driven, last-click, and other attribution models configured in the property
- `sessionSource` / `sessionMedium` reflect GA4's session-scoped attribution, not Cresco first-party rules
- Cross-device and identity resolution follow Google's signals, not Cresco identity links
- Conversion counts may differ from server-side Cresco tracking due to consent, ad blockers, and definition differences

## Thresholding

GA4 applies [thresholding](https://support.google.com/analytics/answer/9383630) to prevent inference of individual users. Dimensions such as `userAgeBracket`, `userGender`, and audience dimensions may return `(not set)` or be withheld. Cresco does not import thresholded demographic dimensions.

Properties are limited to **120 potentially thresholded requests per hour**. Cresco query definitions exclude thresholded dimensions.

## Sampling and cardinality

The GA4 Data API does not use Universal Analytics-style sampling for standard `runReport` responses. However:

- High-cardinality dimensions (e.g. `pagePath` with millions of URLs) increase token cost and may hit row limits (250,000 rows per request)
- GA4 may apply [data thresholds](https://support.google.com/analytics/answer/9383630) on small populations
- Realtime reports have separate quotas and shorter lookback

Cresco paginates report requests and uses `limit` with `offset` for large result sets.

## Realtime summary

`runRealtimeReport` is used for dashboard freshness indicators only (active users in last 30 minutes). Realtime data is not written to daily warehouse aggregates.

## Reconciliation with first-party tracking

GA4 and Cresco first-party data will differ. Documented causes:

| Factor | Effect |
|--------|--------|
| Consent / CMP | GA4 blocked when analytics consent denied; Cresco respects same categories but implementation may differ |
| Ad blockers | Often block GA4 scripts; first-party endpoint may still receive events |
| Timezones | GA4 property timezone vs Cresco property timezone |
| Identity | GA4 client ID vs Cresco anonymous/user ID linking |
| Late events | GA4 processes events up to 72 hours late; reconciliation window re-syncs recent days |
| Bot filtering | Cresco quarantines bots; GA4 has separate bot filtering |
| Metric definitions | `screenPageViews` ≠ Cresco `page_view` count; sessions use different rules |

Neither source is presented as universally correct in the reconciliation UI.

## Compatibility checking

Before running reports, Cresco uses predefined query definitions validated at build time. The Data API `checkCompatibility` method can be used for future expansion; v1 implementation relies on a static registry of known-compatible combinations.

## Error handling

| Error | Handling |
|-------|----------|
| 401 / 403 | Mark connector `REAUTH_REQUIRED` |
| 429 / quota | Retry with backoff; surface quota in UI |
| 400 invalid combination | Rejected at registry — never sent to API |
| 404 property | Mark sync failed; require property re-selection |
