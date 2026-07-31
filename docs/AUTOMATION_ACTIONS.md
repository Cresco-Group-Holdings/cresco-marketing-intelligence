# Automation Actions

Action nodes execute side effects during journey execution. Each action has a typed configuration validated at graph save and runtime.

## Action types (15)

| Type | Description | Required config |
|------|-------------|-----------------|
| `SEND_EMAIL` | Send marketing email via Task 6.5 pipeline | `templateId` or `templateKey`, `senderIdentityId` |
| `CREATE_TASK` | Create CRM follow-up task | `title` |
| `ASSIGN_OWNER` | Assign lead owner | `ownerUserId` |
| `UPDATE_LEAD_STATUS` | Update CRM lead status | `status` |
| `UPDATE_LIFECYCLE` | Update lifecycle stage | `lifecycleStage` |
| `APPLY_TAG` | Add tag to lead | `tag` |
| `REMOVE_TAG` | Remove tag from lead | `tag` |
| `CREATE_OPPORTUNITY_PROPOSAL` | Create opportunity draft | `name` |
| `ADD_TO_AUDIENCE` | Add lead to audience segment | `segmentId` |
| `REMOVE_FROM_AUDIENCE` | Remove lead from segment | `segmentId` |
| `SEND_INTERNAL_NOTIFICATION` | Notify internal team | `message` |
| `WAIT` | Inline wait (prefer DELAY node) | None |
| `BRANCH` | Inline branch (prefer BRANCH node) | None |
| `END` | Terminate path (prefer END node) | None |
| `WEBHOOK` | HTTPS outbound webhook | `url` (allowlisted) |

## High-risk actions

The following actions are classified as **high-risk** and require `requiresApproval: true` on the node config:

- `SEND_EMAIL`
- `WEBHOOK`
- `CREATE_OPPORTUNITY_PROPOSAL`
- `UPDATE_LEAD_STATUS`
- `UPDATE_LIFECYCLE`

`validateGraphSafety` rejects graphs where high-risk action nodes lack `requiresApproval`.

## Disabled without approval

These actions cannot execute on unapproved versions even if the graph is structurally valid:

- `WEBHOOK`
- `CREATE_OPPORTUNITY_PROPOSAL`

## SEND_EMAIL

Marketing emails route through the Task 6.5 email message pipeline with:

- Verified sender identity
- Approved email template
- Consent and suppression checks via exit rules before send
- Frequency limits (3/day, 10/week per lead per automation)

Exit rules with `evaluateBeforeMessaging: true` run immediately before `SEND_EMAIL` execution. Leads without marketing consent or on the suppression list exit the journey instead of receiving the email.

## Webhook allowlist

Outbound webhooks are restricted to HTTPS URLs on an explicit allowlist. Internal and private network targets are blocked.

### Allowed prefixes

| Prefix | Purpose |
|--------|---------|
| `https://api.cresco.example/webhooks/automation` | Cresco internal automation webhook receiver |
| `https://hooks.slack.com/services/` | Slack incoming webhooks |

### Blocked hosts

- `localhost`
- `127.*`
- `10.*` (RFC 1918)
- `172.16–31.*` (RFC 1918)
- `192.168.*` (RFC 1918)
- `0.0.0.0`

`isWebhookUrlAllowed(url)` validates protocol, host, and prefix. Non-allowlisted URLs fail `validateActionConfig`.

### Webhook limits

- Maximum **3 webhook action nodes** per graph
- Frequency limit: 10/day, 50/week per lead
- Must use HTTPS (enforced by both action validation and graph safety)

## Frequency limits

Per-lead action frequency is enforced during execution:

| Action | Per day | Per week |
|--------|---------|----------|
| `SEND_EMAIL` | 3 | 10 |
| `WEBHOOK` | 10 | 50 |
| `CREATE_TASK` | 5 | 25 |
| `CREATE_OPPORTUNITY_PROPOSAL` | 2 | 5 |
| `SEND_INTERNAL_NOTIFICATION` | 10 | 50 |
| `UPDATE_LEAD_STATUS` | 5 | 20 |
| `UPDATE_LIFECYCLE` | 3 | 10 |
| Default (others) | 20 | 100 |

Exceeded limits skip the action and record an error on the enrollment.

## Action validation

`validateActionConfig(actionType, config)` runs at graph save. Errors block `saveGraph`. Common validation failures:

- Missing required fields
- Webhook URL not on allowlist
- Invalid action type string

## Node types vs action types

The graph uses separate node types for flow control:

| Node type | Purpose |
|-----------|---------|
| `TRIGGER` | Entry point (one per graph) |
| `CONDITION` | Evaluate approved conditions, branch |
| `BRANCH` | Multi-path branching |
| `DELAY` | Wait before next step |
| `ACTION` | Execute side effect |
| `GOAL` | Conversion goal tracking |
| `EXIT` | Explicit exit point |
| `END` | Journey completion (one or more) |

Prefer `DELAY` nodes over `WAIT` actions and `BRANCH` nodes over `BRANCH` actions for clarity in the graph editor.
