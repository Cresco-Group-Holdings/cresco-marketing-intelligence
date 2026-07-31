# Automation Operations

Operational guide for managing marketing automation journeys in production.

## Activate

**Permission**: `automation.activate`

**Action**: `activateVersion`

**Prerequisites**:

1. Version is `APPROVED` with valid binding hashes
2. Graph passes structural and safety validation
3. All high-risk actions declare `requiresApproval: true`
4. Webhook URLs are on the allowlist

**Effect**:

- Sets automation status to `ACTIVE`
- Points `activeVersionId` to the approved version
- Enables trigger-based and manual enrollment

**API example**:

```json
POST /api/brands/{brandId}/automation?organisationId={orgId}
{
  "action": "activateVersion",
  "automationId": "auto-123",
  "versionId": "ver-456"
}
```

## Pause

**Permission**: `automation.pause`

**Actions**: `pauseAutomation`, `stopAutomation`, `globalStop`

| Action | Scope | Reversible | Effect on in-flight |
|--------|-------|------------|---------------------|
| `pauseAutomation` | Single journey | Yes (re-activate) | Steps held; no new enrollments |
| `stopAutomation` | Single journey | No | Terminal halt; enrollments exit |
| `globalStop` | All brand journeys | Per-journey | Emergency stop all active |

Paused automations reject new trigger enrollments. In-flight enrollments remain at their current step until resumed or removed.

## Enroll

**Permission**: `automation.enroll`

**Action**: `enrollLead`

Manual enrollment bypasses trigger matching but still enforces:

- Consent and suppression checks
- Repeat policy
- Duplicate active enrollment check
- Automation must be `ACTIVE` (or `TEST` source in test mode)

**API example**:

```json
POST /api/brands/{brandId}/automation?organisationId={orgId}
{
  "action": "enrollLead",
  "automationId": "auto-123",
  "leadId": "lead-789",
  "source": "MANUAL"
}
```

**Remove enrollment**:

```json
{
  "action": "removeEnrollment",
  "automationId": "auto-123",
  "enrollmentId": "enr-456"
}
```

## Test mode

Enroll with `source: "TEST"` to run a journey against a single lead without affecting production metrics or triggering downstream CRM mutations where test guards apply.

Test enrollments:

- Use the active version graph
- Execute actions with test flags where supported (e.g. email test send path)
- Appear in enrollments list with source `TEST`
- Can be removed without affecting production enrollment history

Recommended test flow:

1. Create automation and save graph
2. Approve and activate version
3. Enroll a test lead with `source: "TEST"`
4. Monitor enrollment steps via `GET ?view=enrollments`
5. Remove test enrollment before production launch

## Monitoring

### Enrollments view

```
GET /api/brands/{brandId}/automation?organisationId={orgId}&automationId={id}&view=enrollments
```

Query parameters:

- `status` — filter by `ACTIVE`, `COMPLETED`, `EXITED`
- `leadId` — filter by lead

### Analytics view

```
GET /api/brands/{brandId}/automation?organisationId={orgId}&automationId={id}&view=analytics
```

**Permission**: `automation.viewAnalytics`

Metrics include enrollment counts, completion rates, and step funnel. See `METRIC_LIMITATIONS` in constants for attribution caveats.

### Errors view

```
GET /api/brands/{brandId}/automation?organisationId={orgId}&automationId={id}&view=errors
```

Query parameters:

- `resolved` — `true` or `false`

Resolve errors via:

```json
{
  "action": "resolveError",
  "automationId": "auto-123",
  "errorId": "err-456"
}
```

## Create from template

**Permission**: `automation.manageTemplates`

```json
{
  "action": "createFromTemplate",
  "templateKey": "cresco_grants_lead_nurture"
}
```

Available templates:

| Key | Product | Repeat policy |
|-----|---------|---------------|
| `cresco_grants_lead_nurture` | Cresco Grants | `ONE_TIME` |
| `capital_trial` | Capital Cresco | `ALLOW_AFTER_COMPLETION` |
| `demo_follow_up` | General | `ALLOW_REPEAT` |

Templates create a draft automation with a pre-built graph. Review, approve, and activate before production use.

## Graph editing

**Permission**: `automation.edit`

```json
{
  "action": "saveGraph",
  "automationId": "auto-123",
  "nodes": [...],
  "edges": [...],
  "triggers": [...],
  "exitRules": [...]
}
```

Validation runs on save. Fix reported errors before submitting for review.

## Role permissions summary

| Permission | OWNER | MARKETER | ANALYST | VIEWER |
|------------|-------|----------|---------|--------|
| `automation.read` | ✓ | ✓ | ✓ | ✓ |
| `automation.create` | ✓ | ✓ | — | — |
| `automation.edit` | ✓ | ✓ | — | — |
| `automation.approve` | ✓ | — | — | — |
| `automation.activate` | ✓ | ✓ | — | — |
| `automation.pause` | ✓ | ✓ | — | — |
| `automation.enroll` | ✓ | ✓ | — | — |
| `automation.viewAnalytics` | ✓ | ✓ | ✓ | — |
| `automation.manageTemplates` | ✓ | ✓ | — | — |

## Incident response

1. **Runaway enrollments** — `pauseAutomation` immediately, then investigate trigger config
2. **Consent complaints** — check exit rules have `CONSENT_WITHDRAWN` and `LEAD_SUPPRESSED` with `evaluateBeforeMessaging: true`
3. **Webhook failures** — check errors view; verify URL is on allowlist and target is reachable
4. **Stale approval** — re-approve after material changes before re-activation
5. **Brand-wide issue** — `globalStop` then resolve per-automation
