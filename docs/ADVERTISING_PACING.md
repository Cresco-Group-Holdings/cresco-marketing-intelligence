# Advertising Pacing

Deterministic budget pacing formulas used by `calculatePacing()` in `src/lib/advertising-budget-governance/pacing.ts`.

## Inputs

| Field | Description |
|-------|-------------|
| `periodStart` | Budget period start |
| `periodEnd` | Budget period end |
| `totalBudget` | Approved budget for the period |
| `actualSpend` | Spend recorded to date |
| `asOf` | Computation timestamp (defaults to now) |

## Formulas

All values are computed deterministically:

```
elapsedTimePct = clamp((asOf - periodStart) / (periodEnd - periodStart), 0, 1) × 100

elapsedBudgetPct = (actualSpend / totalBudget) × 100   [if totalBudget > 0]

expectedSpend = totalBudget × (elapsedTimePct / 100)

spendVariance = actualSpend - expectedSpend

projectedSpend = actualSpend / (elapsedTimePct / 100)   [if elapsedTimePct > 0]

remainingBudget = totalBudget - actualSpend

remainingDays = max(0, periodEnd - asOf) in days

requiredDailyPace = remainingBudget / remainingDays   [if remainingDays > 0]
```

## Risk Flags

```
overspendRisk = projectedSpend > totalBudget × (1 + OVERSPEND_RISK_THRESHOLD_PCT / 100)
              default threshold: 10%

underspendRisk = elapsedTimePct >= 50
                 AND projectedSpend < totalBudget × (1 - UNDERSPEND_RISK_THRESHOLD_PCT / 100)
                 default threshold: 20%
```

## Currency

Pacing snapshots store:

- `currency` — account/native currency
- `reportingCurrency` — currency used for cross-provider rollups
- `fxRate`, `fxRateDate`, `fxRateSource` — conversion metadata
- `fxRateMissing` — true when cross-currency rollup lacks a rate

## Snapshot Persistence

Each `computePacing` API call persists an `AdvertisingPacingSnapshot` and evaluates alert rules against the computed metrics.
