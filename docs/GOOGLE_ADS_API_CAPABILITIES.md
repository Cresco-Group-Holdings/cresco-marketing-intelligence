# Google Ads API — Capability Audit (Task 3.5)

Last reviewed: 2026-07-30

## Reporting API

| API | Version | Use in Cresco |
|---|---|---|
| Google Ads API | v18 (REST + GAQL) | Campaign/ad group/ad hierarchy, metrics, conversions, spend |

Primary endpoints: `customers:listAccessibleCustomers`, `googleAds:searchStream` (GAQL).

## OAuth & access

| Requirement | Detail |
|---|---|
| OAuth scope | `https://www.googleapis.com/auth/adwords` |
| Developer token | Required header `developer-token`; Basic/Standard access tiers |
| Manager (MCC) accounts | Supported; customer ID selection required |
| Account access | User must have read access to linked customer |

## Quotas & limits

- Operations quota per developer token (varies by access level)
- `searchStream` row limits per query; paginate with `LIMIT`/`OFFSET` in GAQL
- Rate-limit responses: `RESOURCE_EXHAUSTED` — exponential backoff required

## Attribution & conversions

- Conversion actions defined per account; names and counting types differ
- Default click-through conversion window: 30 days (account-configurable)
- View-through windows vary by conversion action
- **Do not compare conversion totals across providers without showing definitions**

## Currency & timezone

- Account `currency_code` and `time_zone` returned on customer resource
- Spend reported in account currency (micros → currency units)
- Preserve original currency; do not aggregate mixed currencies

## Reporting delays

- Intraday data incomplete; prior 1–3 days may reconcile
- Conversion uploads can backfill up to 90 days

## Commercial restrictions

- Read-only in Cresco: no budget mutations, no campaign create/edit/pause
- Standard API terms; restricted industries require Google approval
- Sensitive categories (housing, credit, employment) have additional policies

## Supported import (Task 3.5)

- spend, impressions, clicks, CTR, CPC, CPM, conversions, conversion value, cost/conversion
- Provider-reported ROAS when `conversion_value / cost` available
- Campaign → ad group → ad hierarchy; creative via ad assets
