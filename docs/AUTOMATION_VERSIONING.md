# Automation Versioning

Marketing automations are versioned immutably. Each graph save creates a new `MarketingAutomationVersion` with its own triggers, nodes, edges, exit rules, and approval bindings.

## Version lifecycle

```
DRAFT (editing) → IN_REVIEW → APPROVED → ACTIVE
                    ↑              │
                    └── stale ─────┘  (material change invalidates approval)
```

1. **Edit** — `saveGraph` creates or updates a draft version
2. **Submit** — `submitForReview` moves to `IN_REVIEW`
3. **Approve** — `approveVersion` records approval with component hashes
4. **Activate** — `activateVersion` sets the version as active (requires valid approval)

## Approval bindings

Each approval records SHA-256 hashes of graph components via `hashGraphComponents`:

| Binding | Hash source | Material change examples |
|---------|-------------|-------------------------|
| `triggerHash` | TRIGGER node config | Trigger type, form ID, segment ID |
| `conditionGraphHash` | CONDITION and BRANCH nodes | Field, operator, value changes |
| `actionGraphHash` | ACTION nodes | Action type, status, tag, webhook URL |
| `templateHash` | SEND_EMAIL action configs | Template ID or key changes |
| `delayHash` | DELAY nodes | Duration, timezone, daypart changes |
| `frequencyLimitHash` | Exit rules array | Exit rule additions or config changes |
| `exitRuleHash` | Exit rules array | Same as frequency (both hash exit rules) |

Hashes use deterministic `stableStringify` (sorted keys) to ensure consistent binding across saves.

## Validation

`isApprovalValid(approval, current)` checks:

1. Approval status is `APPROVED`
2. Each stored hash matches the current graph component hash
3. Mismatches return a specific reason (e.g. "Trigger configuration changed since approval.")

`evaluateRequiredApprovals` returns:

- `complete: true` when a valid approval exists
- `pending` — list of binding types still needed
- `stale` — approval exists but hashes no longer match

## Required approval bindings

Seven binding types must be covered:

1. `TRIGGER`
2. `CONDITION_GRAPH`
3. `ACTION_GRAPH`
4. `TEMPLATES`
5. `DELAYS`
6. `FREQUENCY_LIMITS`
7. `EXIT_RULES`

## Material vs non-material changes

### Material (invalidates approval)

- Trigger type or filter changes
- Condition field, operator, or value changes
- Action type or configuration changes
- Email template changes
- Delay duration, type, or timezone changes
- Exit rule additions, removals, or config changes

### Non-material (does not invalidate)

- Node label or canvas position
- Automation name or description metadata
- Analytics view preferences

## Activation requirements

`activateVersion` verifies:

1. Graph passes `validateAutomationGraph` (structure)
2. Graph passes `validateGraphSafety` (cycles, high-risk approval, webhooks)
3. All trigger configs pass `validateTriggerConfig`
4. All action configs pass `validateActionConfig`
5. All delay configs pass `validateDelayConfig`
6. `evaluateRequiredApprovals` returns `complete: true`

Activation on a stale approval is rejected with the specific binding mismatch.

## Active version pointer

`MarketingAutomation.activeVersionId` points to the currently running version. In-flight enrollments continue on the version they enrolled with. New enrollments use the active version.

## Permissions

| Action | Permission |
|--------|------------|
| Save graph | `automation.edit` |
| Submit for review | `automation.edit` |
| Approve version | `automation.approve` |
| Activate version | `automation.activate` |

Marketers can edit and activate but cannot approve. Owners and admins have full approval access.
