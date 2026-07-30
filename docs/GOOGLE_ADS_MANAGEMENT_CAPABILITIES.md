# Google Ads Management Capabilities (Task 5.4)

Last reviewed: 2026-07-30

## Official API

| API | Version | Use in Cresco |
|---|---|---|
| Google Ads API | v18 (REST + GAQL) | Read hierarchy + controlled mutate for Search campaigns |

## Authentication

| Requirement | Detail |
|---|---|
| Developer token | Required `developer-token` header; Test/Basic/Standard access tiers |
| OAuth 2.0 | Scope `https://www.googleapis.com/auth/adwords` |
| Manager (MCC) | `login-customer-id` header when acting via manager |
| Customer account | 10-digit client customer ID (not manager) |

## Supported mutations (Task 5.4 initial scope)

- Search campaigns (paused on create)
- Campaign budgets (daily, standard delivery)
- Ad groups with manual CPC
- Responsive search ads
- Keyword and negative keyword criteria
- Location and language targeting (draft payload)
- Sitelink/callout extension points (not auto-created in v1)
- Campaign pause via management operations

## Validate-only and partial failure

- `validateOnly: true` on mutate requests for pre-flight checks
- `partialFailure: true` on ad group / ad / criterion batches
- Atomic budget + campaign creation recommended for initial launch

## Test accounts

- Test manager hierarchy required for developer token in Test access
- `customer.test_account` flag inspected on assignment
- UI surfaces test vs production badge

## Quotas

- Operations quota per developer token (tier-dependent)
- `RESOURCE_EXHAUSTED` — exponential backoff required

## Not in scope (feature-flagged)

- Display, Video, Performance Max, Shopping campaign creation
- Automatic budget increases
- AI-initiated mutations without human approval

## Policy and recommendations

- Policy violations returned in mutate error details
- Recommendations API not used for auto-apply in Task 5.4
