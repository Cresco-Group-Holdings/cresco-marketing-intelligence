# TikTok Ads (Marketing API) — Capability Audit (Task 3.5)

Last reviewed: 2026-07-30

## Reporting API

| API | Version | Use in Cresco |
|---|---|---|
| TikTok Marketing API | v1.3 | Advertisers, campaigns, ad groups, ads, reports |

Primary endpoints: `/oauth2/advertiser/get/`, `/campaign/get/`, `/report/integrated/get/`.

## OAuth & access

| Requirement | Detail |
|---|---|
| OAuth scope | `user.info.basic` + Marketing API advertiser access |
| Developer approval | TikTok for Business developer account and app review |
| Account access | Advertiser ID must be authorised for the app |

## Quotas & limits

- QPS and daily call limits per app tier
- Report API: max 30-day range per request for some dimensions
- Pagination via `page` / `page_size`

## Attribution & conversions

- Attribution windows: 1-day click, 7-day click, 1-day view (advertiser setting)
- `conversion` metrics tied to pixel/event definitions
- SKAN metrics separate from web conversions

## Currency & timezone

- Advertiser `currency` and `timezone` on advertiser info
- Spend in advertiser currency

## Reporting delays

- Report data 6–24 hours delay typical
- Same-day data incomplete

## Commercial restrictions

- Read-only in Cresco: no campaign create/edit, no budget spend
- TikTok Marketing API terms; restricted verticals require approval

## Supported import (Task 3.5)

- spend, impressions, clicks, CTR, CPC, CPM, video views
- conversions, conversion value, ROAS when available
- Campaign → ad group → ad hierarchy
