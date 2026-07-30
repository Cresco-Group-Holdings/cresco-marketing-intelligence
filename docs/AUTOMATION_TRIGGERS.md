# Automation Triggers

Marketing automations start from exactly one `TRIGGER` node. The trigger configuration determines which events enroll leads into the journey.

## Trigger types (18)

| # | Type | Description | Required config |
|---|------|-------------|-----------------|
| 1 | `FORM_SUBMITTED` | Lead submits a capture form | `formId` or `formType` |
| 2 | `LEAD_CREATED` | New CRM lead created | Optional `sourceTypes[]`, `productInterests[]` |
| 3 | `LEAD_STATUS_CHANGED` | CRM lead status transition | `fromStatus` and/or `toStatus` |
| 4 | `LIFECYCLE_CHANGED` | Lifecycle stage transition | `fromLifecycle` and/or `toLifecycle` |
| 5 | `PIPELINE_STAGE_CHANGED` | Opportunity pipeline stage change | `pipelineId` and/or `stageId` |
| 6 | `EMAIL_EVENT` | Email engagement event | `emailEventType` |
| 7 | `WEBSITE_EVENT` | Website tracking event | `websiteEventType` |
| 8 | `CONTENT_DOWNLOADED` | Gated content download | `contentKey` |
| 9 | `DEMO_REQUESTED` | Demo request recorded | None |
| 10 | `TRIAL_STARTED` | Product trial begins | None |
| 11 | `TRIAL_ENDING` | Trial approaching expiry | None |
| 12 | `SUBSCRIPTION_STARTED` | Paid subscription begins | None |
| 13 | `PAYMENT_FAILED` | Payment failure detected | None |
| 14 | `SUBSCRIPTION_CANCELLED` | Subscription cancelled | None |
| 15 | `CUSTOMER_INACTIVE` | Customer inactivity threshold | None |
| 16 | `DATE_REACHED` | Calendar date trigger | None |
| 17 | `MANUAL_ENROLLMENT` | Operator or API enrollment only | None |
| 18 | `SCHEDULED_SEGMENT_CHECK` | Scheduled segment membership check | `segmentId` |

## Event matching

`matchTrigger(config, event)` compares the trigger configuration against an incoming `TriggerEvent`:

```typescript
type TriggerEvent = {
  type: TriggerType;
  occurredAt: Date;
  payload: Record<string, unknown>;
};
```

### Filter behaviour

- **String filters** (`formId`, `fromStatus`, `toStatus`, etc.) — omitted filters match any value; specified filters require exact equality.
- **Array filters** (`sourceTypes`, `productInterests`) — omitted arrays match any value; specified arrays require the payload value to be included.
- **Product/lifecycle triggers** (rows 9–16) — match on type only; no additional payload filters.

### Examples

```typescript
// Form submission for a specific form
{ triggerType: "FORM_SUBMITTED", formId: "grant-interest-form" }
// Payload: { formId: "grant-interest-form" } → matches

// Lead created from form source only
{ triggerType: "LEAD_CREATED", sourceTypes: ["FORM"] }
// Payload: { sourceType: "FORM" } → matches
// Payload: { sourceType: "IMPORT" } → no match

// Status change NEW → QUALIFIED
{ triggerType: "LEAD_STATUS_CHANGED", fromStatus: "NEW", toStatus: "QUALIFIED" }
```

## Validation

`validateTriggerConfig(config)` enforces required fields per trigger type before graph save. Invalid configurations block `saveGraph`.

## Enrollment flow

1. Event emitted from CRM, forms, email webhooks, or website tracking
2. Active automations with matching trigger type are evaluated
3. `matchTrigger` filters by payload
4. Entry conditions (if configured on the trigger node) are evaluated via approved condition fields
5. Consent, suppression, and repeat policy checks run
6. Enrollment created with dedupe key `sha256(automationId:leadId[:triggerEventId])`

## Scheduled segment check

`SCHEDULED_SEGMENT_CHECK` runs on a scheduler cadence (not real-time). The scheduler evaluates segment membership and emits trigger events with `{ segmentId }` in the payload. Only automations bound to that segment ID enroll matching leads.

## Manual enrollment

`MANUAL_ENROLLMENT` triggers do not fire from external events. Leads enter via:

- `enrollLead` API action
- Test mode enrollment (source `TEST`)
- Operator UI enrollment action

## Permissions

Trigger configuration changes are part of the version graph and require re-approval when material (see [AUTOMATION_VERSIONING.md](./AUTOMATION_VERSIONING.md)).
