# Advertising Spend Alerts

Alert types triggered by `evaluateBudgetAlerts()` in `src/lib/advertising-budget-governance/alerts.ts`.

## Alert Types

| Type | Severity | Trigger |
|------|----------|---------|
| `SPEND_SPIKE` | WARNING | Daily spend increase ≥ 50% vs prior day |
| `OVERSPEND_RISK` | WARNING | Projected spend exceeds budget + 10% tolerance |
| `BUDGET_EXHAUSTED` | CRITICAL | Remaining budget ≤ 0 |
| `SPEND_AFTER_END_DATE` | CRITICAL | Spend continues after campaign end date |
| `SPEND_WITHOUT_TRACKING` | WARNING | Spend detected with tracking disabled |
| `SPEND_WITHOUT_CONVERSIONS` | INFO | Spend > 0 with zero conversions |
| `CURRENCY_MISMATCH` | WARNING | Account currency ≠ expected currency |
| `PROVIDER_DATA_STALE` | WARNING | Provider data older than 48 hours |
| `DAILY_CHANGE_ABOVE_POLICY` | WARNING | Daily spend change exceeds policy limit (default 20%) |
| `UNEXPECTED_PROVIDER_BUDGET_CHANGE` | CRITICAL | Provider budget changed outside approved workflow |

## Alert Lifecycle

1. Alerts are created during pacing computation or observation ingestion.
2. Alerts appear on `/advertising/budgets/alerts`.
3. Users acknowledge alerts via `acknowledgeAlert` action.
4. Acknowledged alerts are excluded from the active dashboard count.

## Configuration

Default thresholds are defined in `src/lib/advertising-budget-governance/constants.ts`:

- `SPEND_SPIKE_THRESHOLD_PCT` = 50
- `OVERSPEND_RISK_THRESHOLD_PCT` = 10
- `DEFAULT_DAILY_CHANGE_LIMIT_PCT` = 20
- `STALE_PROVIDER_DATA_HOURS` = 48

Policy-level `dailyChangeLimitPct` on `AdvertisingBudgetPolicy` can override daily change limits per brand.

## Currency Alerts

Cross-provider aggregation with missing FX rates produces warnings (not silent conversion). See `aggregateCrossProviderSpend()` in `currency.ts`.
