# Meta Ads (Marketing API) — Capability Audit (Task 3.5)

Last reviewed: 2026-07-30

## Reporting API

| API | Version | Use in Cresco |
|---|---|---|
| Marketing API | v19.0+ | Ad accounts, campaigns, ad sets, ads, creatives, insights |

Primary endpoints: `/me/adaccounts`, `/{ad-account-id}/insights`, `/{object-id}/ads`.

## OAuth & access

| Requirement | Detail |
|---|---|
| OAuth scope | `ads_read` (required), `pages_read_engagement` (optional) |
| App review | Advanced access for `ads_read` on non-owned accounts |
| Business Manager | Ad account must be accessible to authorised user/system user |
| Account access | `GET /act_{id}?fields=account_id,name,currency,timezone_name` |

## Quotas & limits

- App-level rate limits (score-based); `X-Business-Use-Case-Usage` header
- Insights async jobs for large date ranges
- Pagination via `paging.cursors.after`

## Attribution & conversions

- Attribution windows: 1-day click, 7-day click, 1-day view (configurable per ad set)
- `actions` and `action_values` arrays — conversion types vary by pixel/event setup
- **Conversion definitions are Meta-specific; show window in metadata**

## Currency & timezone

- Ad account `currency` and `timezone_name`
- Insights returned in account currency
- Do not silently aggregate accounts with different currencies

## Reporting delays

- Insights typically 24–48 hours behind for full accuracy
- SkadNetwork/iOS data has additional delay and aggregation

## Commercial restrictions

- Read-only in Cresco: no ad create/edit, no budget changes
- Marketing API terms; housing/credit/employment special ad categories
- EU DSA transparency fields may apply

## Supported import (Task 3.5)

- spend, impressions, reach, frequency, clicks, link clicks, CTR, CPC, CPM
- video views, conversions (from actions), conversion value, ROAS when reported
- Campaign → ad set → ad → creative hierarchy
