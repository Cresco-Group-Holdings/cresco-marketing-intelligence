# Advertising Budget Governance

Task 5.8 introduces deterministic budget monitoring, pacing, approval workflows, and safety controls across advertising providers.

## Principles

1. **No autonomous spend increases** — all budget increases require explicit human approval through change requests.
2. **Deterministic pacing** — pacing calculations use documented linear time-weighted formulas (see [ADVERTISING_PACING.md](./ADVERTISING_PACING.md)).
3. **Account currency preservation** — provider observations retain native currency; cross-provider totals require explicit FX conversion.
4. **Human-in-the-loop** — AI may recommend actions but never applies budget mutations.

## Models

| Model | Purpose |
|-------|---------|
| `AdvertisingBudgetPolicy` | Approval thresholds, hard limits, daily change limits |
| `AdvertisingBudgetLimit` | Spend caps at organisation/project/brand/provider/account/campaign/experiment/day/week/month/billing-cycle levels |
| `AdvertisingBudgetAllocation` | Allocated vs spent amounts per scope and period |
| `AdvertisingSpendObservation` | Provider-reported spend snapshots |
| `AdvertisingPacingSnapshot` | Computed pacing metrics at a point in time |
| `AdvertisingBudgetAlert` | Triggered governance alerts |
| `AdvertisingBudgetChangeRequest` | Human-submitted budget change proposals |
| `AdvertisingBudgetApproval` | Approval/rejection audit trail |
| `AdvertisingSpendIncident` | Emergency controls and freeze events |

## Budget Levels

Limits can be scoped at:

- Organisation, project, brand
- Provider, account, campaign, experiment
- Day, week, month, billing cycle

## Change Request Workflow

1. Marketer submits request with reason, evidence, current/proposed budget, projected impact, and risk.
2. Policy engine evaluates required approver (admin, owner, or client for managed accounts).
3. Changes above hard limit are auto-rejected.
4. Approved requests are recorded; increases are never applied without approval.

## API

- `GET /api/brands/[brandId]/advertising/budgets` — dashboard
- `POST` actions: `createPolicy`, `computePacing`, `createChangeRequest`, `recordObservation`, `aggregateSpend`, `aiRecommendation`
- `POST /api/brands/[brandId]/advertising/budgets/[resourceId]` — `approveChangeRequest`, `rejectChangeRequest`, `acknowledgeAlert`, `triggerEmergency`, `resolveIncident`

## Permissions

- `advertisingBudgets.read` — view dashboards, pacing, alerts
- `advertisingBudgets.manage` — create policies, record observations
- `advertisingBudgets.request` — submit change requests
- `advertisingBudgets.approve` — approve/reject requests
- `advertisingBudgets.emergency` — trigger/resolve emergency controls

## UI Routes

- `/advertising/budgets` — overview
- `/advertising/budgets/pacing` — pacing computation
- `/advertising/budgets/alerts` — alert management
- `/advertising/budgets/requests` — change requests
- `/advertising/budgets/policies` — policy configuration
- `/advertising/budgets/incidents` — emergency controls

## Related Documentation

- [ADVERTISING_PACING.md](./ADVERTISING_PACING.md)
- [ADVERTISING_SPEND_ALERTS.md](./ADVERTISING_SPEND_ALERTS.md)
- [ADVERTISING_EMERGENCY_CONTROLS.md](./ADVERTISING_EMERGENCY_CONTROLS.md)
