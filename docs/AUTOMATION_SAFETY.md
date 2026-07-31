# Automation Safety

Safety controls prevent runaway journeys, consent violations, and abuse of outbound messaging.

## Loop prevention

### Graph cycle detection

`detectCycles(graph)` performs bounded DFS (default bound: 1,000 steps) to detect cycles in the node graph. Cyclic graphs fail `validateGraphSafety` and cannot be activated.

```
trigger → email → delay → condition
              ↑              │
              └──────────────┘   ← cycle detected, graph rejected
```

### Path and depth bounds

`validateAutomationGraph` enforces structural limits:

| Limit | Value | Purpose |
|-------|-------|---------|
| `MAX_GRAPH_NODES` | 100 | Prevent oversized graphs |
| `MAX_GRAPH_DEPTH` | 50 | Limit traversal depth |
| `MAX_PATH_COUNT` | 20 | Cap branching explosion |

Graphs exceeding these limits fail validation at save time.

### Automation recursion

When one automation enrolls a lead into another (`ADD_TO_AUDIENCE` or cross-automation triggers), `checkAutomationRecursion` enforces:

- **Maximum recursion depth**: 3 occurrences of the same automation ID in the enrollment chain
- **Circular enrollment detection**: same automation ID cannot appear twice in the chain

Violations block enrollment and record an error.

## Frequency limits

Per-lead action frequency is tracked in enrollment step history. `checkActionFrequency` compares recent executions against per-action daily and weekly limits (see [AUTOMATION_ACTIONS.md](./AUTOMATION_ACTIONS.md)).

When a limit is exceeded:

1. The action is skipped
2. An error is recorded on the enrollment
3. The journey continues to the next node (does not auto-exit)

## Consent and suppression

### Enrollment eligibility

Before enrollment, `checkEnrollmentEligibility` verifies:

- Automation is `ACTIVE`
- Lead has marketing consent (`consentMarketing: true`)
- Lead is not on the email suppression list
- Lead has not unsubscribed from marketing email

Failed checks reject enrollment with explicit reasons.

### Pre-messaging exit rules

Exit rules with `evaluateBeforeMessaging: true` (default) run before every messaging action:

| Exit reason | Condition |
|-------------|-----------|
| `CONSENT_WITHDRAWN` | `consentMarketing === false` |
| `LEAD_SUPPRESSED` | Suppression list or unsubscribe |
| `CUSTOMER_CONVERTED` | Lead converted to customer |
| `SUBSCRIPTION_STARTED` | Active subscription detected |
| `OPPORTUNITY_LOST` | Linked opportunity marked lost |
| `SUPPORT_ISSUE_OPENED` | Open support ticket |
| `GOAL_ACHIEVED` | Journey goal met |
| `MAX_DURATION_REACHED` | Enrollment exceeded max duration |
| `AUTOMATION_STOPPED` | Journey stopped or paused |

Consent withdrawal and suppression exits prevent email sends even if the lead was eligible at enrollment time.

## Duplicate enrollment

`checkDuplicateEnrollment` blocks enrollment when the lead has an **ACTIVE** enrollment in the same automation. Completed or exited enrollments may re-enroll depending on repeat policy.

## Repeat policy

| Policy | Behaviour |
|--------|-----------|
| `ONE_TIME` | Lead may enroll only once ever |
| `ALLOW_REPEAT` | Re-enroll after exit/completion; block if currently active |
| `ALLOW_AFTER_COMPLETION` | Re-enroll only if never completed; block active and completed |

## Condition safety (no arbitrary SQL)

Conditions evaluate against a typed `LeadSnapshot` using an approved field list and operator set. There is no SQL execution, raw query injection, or dynamic field access:

- **16 approved fields**: `LIFECYCLE`, `LEAD_STATUS`, `OPPORTUNITY_STAGE`, `PRODUCT`, `COUNTRY`, `LANGUAGE`, `CONSENT`, `SOURCE`, `CAMPAIGN`, `ACTIVITY`, `EMAIL_ENGAGEMENT`, `PRODUCT_EVENT`, `SUBSCRIPTION_STATE`, `DATE`, `OWNER`, `TAG`
- **8 operators**: `eq`, `ne`, `in`, `not_in`, `gt`, `lt`, `contains`, `exists`

Unapproved fields and invalid operators return `false` (fail-safe, never match).

## Webhook abuse prevention

- HTTPS only
- Allowlisted URL prefixes only
- Private/reserved IP ranges blocked
- Maximum 3 webhook nodes per graph
- Frequency limits per lead

## Emergency controls

| Control | Permission | Effect |
|---------|------------|--------|
| `pauseAutomation` | `automation.pause` | Stop new enrollments; hold in-flight steps |
| `stopAutomation` | `automation.pause` | Terminal halt for one journey |
| `globalStop` | `automation.pause` | Stop all brand automations |
| `removeEnrollment` | `automation.enroll` | Remove individual lead from journey |

## Error handling

Execution errors are recorded in `MarketingAutomationError` with:

- Error type and message
- Node ID and action type
- Enrollment context
- Resolution status (operator can mark resolved)

Unresolved errors appear in the `errors` API view for monitoring.

## Dedupe keys

Enrollment dedupe keys are SHA-256 hashes of `automationId:leadId` (or `automationId:leadId:triggerEventId` when a trigger event ID is present). This prevents duplicate enrollments from retried trigger events.
