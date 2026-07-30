# LinkedIn Ads (Marketing API) — Capability Audit (Task 3.5)

Last reviewed: 2026-07-30

## Reporting API

| API | Version | Use in Cresco |
|---|---|---|
| LinkedIn Marketing API | 202405+ | Ad accounts, campaigns, creatives, analytics |

Primary endpoints: `adAccounts`, `adCampaigns`, `creatives`, `adAnalytics`.

## OAuth & access

| Requirement | Detail |
|---|---|
| OAuth scope | `r_ads` (required for ads reporting), `r_organization_social` (org context) |
| Developer approval | Marketing Developer Platform access required |
| Account access | User must be assigned to ad account in Campaign Manager |

## Quotas & limits

- Daily/throttled quotas per application; `429` with `Retry-After`
- Analytics API: max 20 metrics per request, date range limits
- Pagination via `paging.start` / `paging.count`

## Attribution & conversions

- Conversion tracking via Insight Tag or CAPI
- Attribution window: typically 30-day click, 7-day view (campaign-dependent)
- Conversion metrics named per conversion rule — preserve rule ID in metadata

## Currency & timezone

- Account `currency` and `timezone` on `adAccounts` resource
- Spend in account currency (micro amounts for some fields)

## Reporting delays

- Analytics data 24–72 hours to stabilise
- Recent days may reconcile

## Commercial restrictions

- Read-only in Cresco: no campaign mutations or budget changes
- LinkedIn Marketing API terms apply
- Member privacy thresholds may suppress low-volume metrics

## Supported import (Task 3.5)

- spend, impressions, clicks, CTR, CPC, conversions, conversion value
- Campaign → campaign group → creative hierarchy (mapped to canonical ad group/ad)
- Provider hierarchy differences stored in `providerMetadata`
