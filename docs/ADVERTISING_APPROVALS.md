# Advertising Approvals

Task 5.1 integrates with the Stage 2 approval workflow pattern via separated approval types on `AdvertisingCampaignApproval`.

## Approval types

| Type | Scope |
|------|-------|
| STRATEGY | Objective, channel mix, messaging direction |
| BUDGET | Budget amounts and allocation |
| AUDIENCE | Audience definitions and exclusions |
| CREATIVE | Creative requirements and attached assets |
| COMPLIANCE | Regulatory and brand compliance review |
| LAUNCH | Final launch authorisation |

## Decisions

`PENDING`, `APPROVED`, `CHANGES_REQUESTED`, `REJECTED`

## Workflow

1. Plan moves to `READY_FOR_REVIEW` via submit-review or readiness engine.
2. Editor requests approval per type (`request-approval` action).
3. Approver with matching permission decides (`approve` action).
4. `CHANGES_REQUESTED` moves plan to `CHANGES_REQUESTED` status.
5. When all six types are `APPROVED` and launch is approved, plan moves to `APPROVED`.

## Permissions

- `advertisingPlans.approveStrategy`
- `advertisingPlans.approveBudget`
- `advertisingPlans.approveCreative`
- `advertisingPlans.approveCompliance`
- `advertisingPlans.approveLaunch`

**No approval is assumed from campaign creation.**

## Version comparison

`AdvertisingCampaignPlanVersion` stores structured AI output and change notes for comparison during review. Full diff UI is deferred; versions are accessible via API.
