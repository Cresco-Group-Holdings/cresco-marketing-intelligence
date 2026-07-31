# Advertising Optimisation Actions

Action proposals are classified into action classes. No material action is applied without approval.

## Action Classes

| Class | Description | Approval |
|-------|-------------|----------|
| `INFORMATION_ONLY` | Advisory insight only | Not required |
| `CREATE_TASK` | Create internal review task | Optional |
| `CREATE_EXPERIMENT` | Propose A/B test | Required |
| `CREATE_CREATIVE_REQUEST` | Request new/rotated creative | Required |
| `REQUEST_BUDGET_CHANGE` | Budget increase or decrease | Required + workflow |
| `REQUEST_PAUSE` | Pause campaign for review | Required |
| `REQUEST_RESUME` | Resume paused campaign | Required |
| `REQUEST_PROVIDER_CHANGE` | Targeting, placement, schedule, bid changes | Required |

## Material Actions

These classes are considered material and always require approval:

- `REQUEST_BUDGET_CHANGE`
- `REQUEST_PAUSE`
- `REQUEST_RESUME`
- `REQUEST_PROVIDER_CHANGE`

## Approval Workflow

1. Recommendation generated with linked action proposal
2. Proposal status: `PENDING`, `BLOCKED`, `APPROVED`, `REJECTED`, or `DEFERRED`
3. Human approves via `approveAction` API
4. `AdvertisingOptimisationApproval` record created
5. Action may proceed through appropriate downstream workflow (budget change request, experiment creation, etc.)

## Blocked Actions

Actions from LLM output for budget or provider changes are created with `status: BLOCKED` and require human review to unblock through the approval workflow.

## Outcomes

After implementation, `recordOutcome` captures pre/post metrics. `successClaimed` is only `true` when `outcomeStatus: MEASURED` and post-change metrics are present.

## Feedback

Users submit feedback with status:

- `ACCEPTED`, `REJECTED`, `DEFERRED`
- `IMPLEMENTED`, `OUTCOME_MEASURED`, `OUTCOME_UNAVAILABLE`

Rejection requires `userExplanation`.
