# CRM Follow-Up Rules

Deterministic rules that surface follow-up gaps before AI assistance.

## Model

`CrmFollowUpRule` with `CrmFollowUpRuleTrigger` enum.

## Triggers

| Trigger | Condition |
|---------|-----------|
| `NEW_LEAD_NO_OWNER` | Lead has no owner |
| `QUALIFIED_LEAD_NO_TASK` | Qualified lead with no open task |
| `DEMO_REQUEST_NOT_CONTACTED` | Demo interest, no recent activity |
| `MEETING_NO_NEXT_STEP` | Completed meeting without follow-up task |
| `PROPOSAL_NO_FOLLOW_UP` | Opportunity in proposal stage, no open task |
| `TRIAL_ENDING` | Trial ends within 7 days |
| `OPPORTUNITY_INACTIVE` | No activity for 14+ days |
| `RENEWAL_APPROACHING` | Expected close within 30 days |
| `PAYMENT_FAILED` | Extension point for billing integration |
| `LEAD_REPLIED_NO_TASK` | Lead replied, no response task |

## Evaluation

`POST .../crm/tasks` with `action: "evaluateFollowUpRules"` scans leads, opportunities, and completed meetings. Matching gaps create `CrmFollowUpSuggestion` records with `aiGrounded: true` and `autoSendBlocked: true`.

## Suggestions

Users accept suggestions to create tasks (`acceptSuggestion`) or dismiss them (`dismissSuggestion`). Accepted suggestions link to the created `CrmTask`.

## Reminder frequency

Rule evaluation creates at most one pending suggestion per title/entity. Task reminders enforce a minimum 4-hour interval between notification types.
