# AI Follow-Up Assistant

Grounded AI proposals for next-best actions. The assistant never sends messages automatically.

## Model

`CrmFollowUpSuggestion` with `aiEvidence`, `aiGrounded`, and `autoSendBlocked` (always `true`).

## Inputs

The assistant uses:

- CRM activity history (verified logged activities only)
- Open tasks and pipeline stage
- Product context
- User instructions
- Explicit consent (`consentGranted: true`)

## Outputs

Proposals may include:

- Next-best action title and description
- Recommended task type and due date
- Meeting agenda
- Call preparation notes
- Response outline
- Follow-up draft (marked for review only)
- Risk summary

## API

`POST /api/brands/{brandId}/crm/tasks` with:

```json
{
  "action": "generateAiSuggestion",
  "leadId": "...",
  "opportunityId": "...",
  "consentGranted": true,
  "userInstructions": "optional"
}
```

## Safety

- Returns `null` / validation error without consent
- Returns error without sufficient CRM evidence
- `autoSendBlocked` is always set on persisted suggestions
- Draft content includes explicit "Do not auto-send" guidance
- Permission: `aiFollowUp.generate`

## Calendar integration

Meeting records support external calendar IDs for future sync. Only authorised scope metadata is stored; private calendar content is excluded.
