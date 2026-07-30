# Meta Ads Management Capabilities (Task 5.5)

Last reviewed: 2026-07-30

## Official API

| API | Version | Use in Cresco |
|---|---|---|
| Marketing API (Graph) | v19.0+ | Campaign, ad set, ad, creative management |

Primary endpoints: `/act_{id}/campaigns`, `/adsets`, `/adcreatives`, `/ads`, `/{pixel_id}/events` (CAPI).

## Authentication & permissions

| Requirement | Detail |
|---|---|
| OAuth scopes | `ads_read`, `ads_management`, `business_management` (write ops) |
| App review | Required for `ads_management` on third-party accounts |
| Business Manager | Business, ad account, Page, Instagram identity selection |
| System user | Optional for server-to-server (deferred) |

## Hierarchy

Business Manager → Ad Account → Campaign → Ad Set → Ad (+ Ad Creative)

Objects must be created in order. Cresco stores provider IDs per resource for idempotent retries.

## Objectives (initial)

| Internal | Meta ODAX |
|---|---|
| Website traffic | OUTCOME_TRAFFIC |
| Lead generation | OUTCOME_LEADS |
| Purchases | OUTCOME_SALES |
| Video views | OUTCOME_AWARENESS |
| Brand awareness | OUTCOME_AWARENESS |
| Engagement | OUTCOME_ENGAGEMENT |

## Targeting & policy

- Approved fields: geo, age (18+), language, interests, custom audiences, exclusions, placements
- Prohibited sensitive attributes blocked locally
- Special Ad Categories required for housing/credit/employment (empty array default)

## Creative formats (initial)

Single image, carousel, short video, Reel, Story, feed, lead-form extension point.

## Conversions API

- Server events via `/{pixel_id}/events`
- Event deduplication via `event_id` + browser `eventID`
- Consent-gated; hashed PII only; no raw data in logs

## Rate limits

- Spend-based quota per ad account (`X-Business-Use-Case-Usage`)
- 100 QPS burst limit on mutation endpoints
- Error codes: 17, 80004 (rate limit), 190 (token), 200 (permission)

## Test accounts

- Meta test ad accounts supported via Business Manager sandbox
- `isTestAccount` flag on brand assignment (extension point)

## Not in scope (feature-flagged)

- App promotion, Messenger ads, automatic placements without review
- Autonomous budget/bid changes
