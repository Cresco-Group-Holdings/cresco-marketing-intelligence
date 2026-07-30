# Advertising Budget Governance

## Budget types

`AdvertisingCampaignBudget` supports:

- `DAILY`, `LIFETIME`, `MONTHLY`, `FLIGHT`, `MANUAL_ALLOCATION`

## Stored fields

- Original currency and amount (no conversion without stored rate)
- Minimum, maximum, channel allocation, reserve amount
- Pacing method (`EVEN`, `ACCELERATED`, `STANDARD`)
- Planned start/end aligned with campaign schedule
- Approval threshold and budget owner

## Rules (Task 5.1)

1. Budget currency must match plan `reportingCurrency`.
2. Planned end must be after planned start.
3. Budgets above `BUDGET_APPROVAL_THRESHOLD_DEFAULT` (10,000) require elevated budget approval.
4. **No provider budgets are modified** in this task.

## Channel allocation

Budgets may be plan-level (`channelId` null) or channel-specific. Channel allocation percentages are stored on the budget record for planning purposes only.

## Approval

Budget changes require `advertisingPlans.approveBudget` permission. Large budgets trigger threshold-based review before launch approval.
