# Currency Governance

Multi-currency marketing data requires consistent FX handling for cross-source spend, revenue, and ROI reporting. Task 3.1 provides the schema and manual rate entry; automated rate feeds are deferred.

## Models

| Model | Purpose |
| --- | --- |
| `CurrencyRate` | Daily exchange rate between currency pair |
| `CurrencyConversionRecord` | Audit trail of applied conversion on an entity |

## Rate storage

`CurrencyRate`:

| Field | Purpose |
| --- | --- |
| `baseCurrency` | ISO 4217 code (e.g. `USD`) |
| `quoteCurrency` | ISO 4217 code (e.g. `EUR`) |
| `rate` | `1 base = rate quote` (Decimal 24,10) |
| `effectiveDate` | Calendar date the rate applies |
| `source` | `MANUAL`, `ECB`, `OPEN_EXCHANGE`, `PROVIDER` |
| `organisationId` | Optional org scope; `null` = platform global |

Unique constraint: `[baseCurrency, quoteCurrency, effectiveDate, source]`.

### Rate direction

Rates are stored as **base → quote**:

```
targetAmount = sourceAmount × rate
```

Example: `baseCurrency = USD`, `quoteCurrency = EUR`, `rate = 0.92`  
→ 100 USD = 92 EUR

Inverse lookups use the reciprocal rate or a separate stored pair.

## Brand reporting currency

Each brand resolves a reporting currency in order:

1. `MarketingDataSourceAccount.currency` on primary account (if set)
2. `Brand` metadata reporting currency (future field)
3. `Organisation` default currency (future field)
4. `USD` fallback

All cross-currency dashboards convert to the brand reporting currency at query time using the rate effective on the observation date.

## Conversion audit

`CurrencyConversionRecord` records every applied conversion:

| Field | Purpose |
| --- | --- |
| `currencyRateId` | Rate used |
| `sourceAmount` / `sourceCurrency` | Original value |
| `targetAmount` / `targetCurrency` | Converted value |
| `convertedAt` | Conversion timestamp |
| `entityType` / `entityId` | Source entity (`MarketingCostRecord`, `MarketingRevenueRecord`, `MarketingMetricObservation`) |

Conversions are immutable — corrections create new records.

## Scope in Task 3.1

| Capability | Status |
| --- | --- |
| Manual rate entry API | Active |
| Organisation-scoped rates | Active |
| Platform global rates (seed) | Test fixtures only |
| ECB daily feed | Deferred — `source = ECB` enum reserved |
| Open Exchange Rates API | Deferred — `source = OPEN_EXCHANGE` enum reserved |
| Provider-native currency (Google Ads billing) | Deferred — `source = PROVIDER` enum reserved |
| Historical rate backfill UI | Deferred |
| Intra-day rates | Not supported — daily grain only |

## Manual rate entry

```
POST /api/brands/[brandId]/marketing-data/currency-rates
```

```json
{
  "baseCurrency": "USD",
  "quoteCurrency": "GBP",
  "rate": "0.79",
  "effectiveDate": "2026-07-30"
}
```

Permission: `marketingData.manage`.

Rates are validated:

- ISO 4217 currency codes (3 uppercase letters)
- `rate > 0`
- `effectiveDate` not more than 30 days in the future
- Duplicate pair+date+source rejected

## Affected entities

Currency fields on warehouse facts:

| Entity | Currency field | Notes |
| --- | --- | --- |
| `MarketingCostRecord` | `currency` | Provider spend |
| `MarketingRevenueRecord` | `currency` | Recognised revenue |
| `MarketingMetricObservation` | via `unit` / metadata | When `dataType = CURRENCY` |
| `DailyMarketingAggregate` | `currency` | Rollup currency |
| `MarketingCampaign` | `budgetCurrency` | Budget display only |

Social metrics do not carry currency in 3.1. Cost per result remains unavailable until spend integration (`docs/SOCIAL_ANALYTICS.md`).

## Query-time conversion

Reporting services:

1. Resolve brand reporting currency
2. For each fact, look up `CurrencyRate` for `[fact.currency, reportingCurrency, observationDate]`
3. Apply rate; record `CurrencyConversionRecord` on first conversion per query (cached within request)
4. Omit facts when no rate exists (never guess or use stale rate without flag)

Missing rate behaviour: metric excluded from cross-currency totals with `unavailableCurrency` metadata in response.

## Testing

Test suites use seeded rates:

| Pair | Rate | Date |
| --- | --- | --- |
| USD → EUR | 0.92 | 2026-01-01 |
| USD → GBP | 0.79 | 2026-01-01 |
| EUR → GBP | 0.86 | 2026-01-01 |

`source = MANUAL`, `organisationId = null`.

## Governance rules

1. **No implicit FX** — conversions always reference an explicit `CurrencyRate` row
2. **Daily grain** — one rate per pair per calendar day
3. **Audit trail** — `CurrencyConversionRecord` for every applied conversion in reports
4. **No secrets in rates** — API keys for future ECB/Open Exchange feeds are env-only
5. **Operator accountability** — manual rate changes audit-logged with user ID

## Related documentation

- `docs/METRIC_REGISTRY.md` — currency metric types
- `docs/MARKETING_DATA_MODEL.md` — revenue and cost entities
- `docs/WAREHOUSE_OPERATIONS.md` — rate management UI
- `docs/DATA_QUALITY.md` — range checks on rates
