# Opportunity Management

## Core fields

| Field | Model |
|-------|-------|
| Owner | `ownerUserId` |
| Company | `companyId` |
| Contacts | `CrmOpportunityContactRole` |
| Product/plan | `product`, `plan`, `CrmOpportunityProduct` |
| Value | `CrmOpportunityValue` (EXPECTED, RECURRING) |
| Close date | `expectedCloseDate` |
| Probability | `probability` + `CrmOpportunityProbability` history |
| Source/campaign | `campaign`, `attributionJourneyId` |
| Competitors | `CrmOpportunityCompetitor` |
| Next action | `nextAction` |
| Loss reason | `CrmOpportunityLossReason` (configurable) |
| Custom fields | Via `CrmCustomFieldValue` (Task 6.1) |

## Status lifecycle

OPEN → WON | LOST | ARCHIVED

Stage movement is separate from status — use `moveStage` for pipeline progression, `markWon`/`markLost` for terminal states.

## Won evidence (required)

- SUBSCRIPTION_CONFIRMED
- PAYMENT_COMPLETED
- AGREEMENT_SIGNED
- AUTHORISED_CONFIRMATION

AI recommendations cannot trigger won status.

## Lost requirements

- Configurable loss reason (required)
- Optional competitor
- Notes
- Re-engagement eligibility (defaults from loss reason config)

## Stage transitions

Every transition recorded in `CrmOpportunityStageHistory` with:
- Previous/new stage and category
- Actor, reason, source, timestamp

Validation checks: required fields, permissions, entry/exit criteria, approval, duplicate policy, no stage skipping.

## Views

- Kanban by pipeline stage
- Table/list with filters (owner, product, status)
- Stale and closing-this-month via health/forecast endpoints
