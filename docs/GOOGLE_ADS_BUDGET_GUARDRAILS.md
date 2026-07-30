# Google Ads Budget Guardrails

## Enforced limits

| Guardrail | Default |
|---|---|
| Approved maximum daily budget | From plan / approval record |
| Daily change limit | 20% per adjustment |
| Currency match | Account currency must equal plan currency |
| Plan limit | Plan `totalBudgetAmount` / daily budget |
| Organisation policy max | Configurable per org (extension point) |
| Minimum daily budget | 1,000,000 micros (~$1) |
| Emergency pause | Blocks all increases when active |

## Prohibited actions

- **No automatic increase** — budget up requires explicit approved operation
- **No AI-only mutation** — `isAiSuggested: true` always blocked
- **No launch above approved max** — checked at mutation plan build and budget adjust preview

## Management operations

Budget adjustments flow through:

1. `preview-budget` — runs `evaluateBudgetGuardrails`
2. Human confirmation with reason
3. Audited `AdvertisingGoogleAdsOperation` record
4. Provider mutate (when implemented for budget update)

## Emergency pause

When spend exceeds `BUDGET_EMERGENCY_PAUSE_THRESHOLD_PERCENT` (150%) of approved daily budget, warn and block automatic recovery increases until cleared by admin.
