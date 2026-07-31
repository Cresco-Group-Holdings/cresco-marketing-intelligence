# Ad Budget Incident Runbook

## Overspend risk alert

1. Review `/advertising/budgets/pacing` for projected spend
2. Evaluate `OVERSPEND_RISK` alert details
3. Options:
   - Submit budget decrease change request
   - Trigger emergency pause
   - Pause campaign in provider UI (manual)

## Budget exhausted

1. `BUDGET_EXHAUSTED` alert — CRITICAL severity
2. Trigger `EMERGENCY_PAUSE` if spend continues
3. Verify provider campaign status
4. Submit budget increase change request (requires approval)

## Unexpected provider budget change

1. `UNEXPECTED_PROVIDER_BUDGET_CHANGE` alert — CRITICAL
2. Investigate: manual edit in provider UI vs platform bug
3. Record in `AdvertisingSpendIncident`
4. Freeze account if unauthorised: `ACCOUNT_FREEZE`

## Currency mismatch

1. Verify account currency matches plan currency
2. Do not aggregate mixed-currency totals without FX rate
3. Review `fxRateMissing` warnings in pacing snapshots

## Emergency pause procedure

See `docs/AD_EMERGENCY_PAUSE.md`

## Restoration

1. Resolve root cause
2. Submit restoration with `restorationApproved: true`
3. Verify `canMutateBudget()` returns allowed
4. Resume normal operations with monitoring
