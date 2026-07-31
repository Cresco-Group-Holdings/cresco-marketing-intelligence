# Marketing Automation Engine

Journey-based marketing automation for lead nurture, onboarding, and lifecycle messaging with approval gates, consent enforcement, and bounded graph execution.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Trigger events │────▶│ Enrollment layer │────▶│ Execution scheduler │
│  (CRM, forms,   │     │ (eligibility,    │     │ (node traversal,    │
│   email, web)   │     │  dedupe, repeat) │     │  delays, actions)   │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Graph builder   │     │ Exit rules       │     │ Email / CRM /       │
│ (validation,    │     │ (consent,        │     │ webhook actions     │
│  safety checks) │     │  suppression)    │     │ via Task 6.5 email  │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

### Core layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Graph model | `src/lib/marketing-automation/graph-validation.ts` | Node/edge schema, path bounds, orphan detection |
| Triggers | `src/lib/marketing-automation/triggers.ts` | 18 trigger types with typed config matching |
| Conditions | `src/lib/marketing-automation/conditions.ts` | Approved-field evaluation (no arbitrary SQL) |
| Actions | `src/lib/marketing-automation/actions.ts` | Action validation, high-risk gating, webhook allowlist |
| Delays | `src/lib/marketing-automation/delays.ts` | Fixed, datetime, business-day, daypart, event waits |
| Exit rules | `src/lib/marketing-automation/exit-rules.ts` | Pre-messaging consent/suppression and goal exits |
| Safety | `src/lib/marketing-automation/safety.ts` | Cycle detection, frequency limits, recursion bounds |
| Approval | `src/lib/marketing-automation/approval.ts` | Version hash binding for material changes |
| Enrollment | `src/lib/marketing-automation/enrollment.ts` | Consent, suppression, repeat policy, dedupe keys |
| Service | `src/server/services/marketing-automation-service.ts` | CRUD, versioning, activation lifecycle |
| Execution | `src/server/services/marketing-automation-execution-service.ts` | Per-enrollment node processing |
| Enrollment service | `src/server/services/marketing-automation-enrollment-service.ts` | Trigger matching, manual/API enroll |

## Data model

- `MarketingAutomation` — top-level journey with status and active version pointer
- `MarketingAutomationVersion` — immutable versioned graph snapshot
- `MarketingAutomationNode` / `MarketingAutomationEdge` — graph structure
- `MarketingAutomationTrigger` — trigger configuration per version
- `MarketingAutomationExitRule` — exit conditions evaluated during execution
- `MarketingAutomationApproval` — bound approval hashes per version
- `MarketingAutomationEnrollment` — per-lead journey instance
- `MarketingAutomationEnrollmentStep` — step execution history
- `MarketingAutomationError` — execution errors with resolution tracking

## Status lifecycle

`DRAFT` → `IN_REVIEW` → `APPROVED` → `ACTIVE` → `PAUSED` / `STOPPED` → `ARCHIVED`

Only `ACTIVE` automations enroll leads from triggers. `PAUSED` stops new enrollments and holds in-flight steps. `STOPPED` is a terminal halt.

## API

`GET/POST /api/brands/{brandId}/automation?organisationId={orgId}`

| Action | Permission | Description |
|--------|------------|-------------|
| `createAutomation` | `automation.create` | Create draft journey |
| `updateAutomation` | `automation.edit` | Update metadata |
| `saveGraph` | `automation.edit` | Persist versioned graph |
| `submitForReview` | `automation.edit` | Move to `IN_REVIEW` |
| `approveVersion` | `automation.approve` | Grant version approval |
| `activateVersion` | `automation.activate` | Activate approved version |
| `pauseAutomation` | `automation.pause` | Pause active journey |
| `stopAutomation` | `automation.pause` | Stop journey permanently |
| `globalStop` | `automation.pause` | Emergency stop all brand automations |
| `enrollLead` | `automation.enroll` | Manual/API enrollment |
| `removeEnrollment` | `automation.enroll` | Remove lead from journey |
| `createFromTemplate` | `automation.manageTemplates` | Instantiate journey template |

GET views: `templates`, `analytics`, `enrollments`, `errors`

## Built-in templates

Three starter journeys in `src/lib/marketing-automation/templates.ts`:

- **Cresco Grants lead nurture** — form submission → email sequence with delays
- **Capital trial** — trial started → onboarding emails
- **Demo follow-up** — demo requested → sales follow-up sequence

## UI

- `/automation` — journey list
- `/automation/new` — create journey
- `/automation/[id]` — graph editor, review, enrollments, analytics

## Related documentation

- [AUTOMATION_TRIGGERS.md](./AUTOMATION_TRIGGERS.md) — all 18 trigger types
- [AUTOMATION_ACTIONS.md](./AUTOMATION_ACTIONS.md) — action types and webhook policy
- [AUTOMATION_SAFETY.md](./AUTOMATION_SAFETY.md) — loop prevention and abuse controls
- [AUTOMATION_VERSIONING.md](./AUTOMATION_VERSIONING.md) — approval binding
- [AUTOMATION_OPERATIONS.md](./AUTOMATION_OPERATIONS.md) — operational runbook
