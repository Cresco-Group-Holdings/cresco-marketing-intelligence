# Advertising Campaign Planning

Task 5.1 introduces a **provider-independent campaign planning layer** separate from imported performance data (`MarketingCampaign`) and future provider publishing.

## Architectural separation

| Layer | Purpose |
|-------|---------|
| Internal campaign plan | Structured planning before any provider action |
| Provider draft | Validation-only configuration snapshot |
| Approved launch version | Human-approved plan ready for provider setup |
| Published provider entity | Created in Task 5.2+ (not in 5.1) |
| Imported performance | Stage 3 warehouse records |

Plans use status `DRAFT` → `PLANNING` → `READY_FOR_REVIEW` → `APPROVED` → `PROVIDER_CONFIGURATION` → `READY_TO_LAUNCH`. No plan is treated as an active advertising campaign until explicitly launched in a later task.

## Core models

- `AdvertisingCampaignPlan` — root plan with objective, dates, currency, budget
- `AdvertisingCampaignPlanVersion` — versioned snapshots including AI proposals
- Child plans: objectives, channels, budgets, schedule, destinations, conversion goals, audiences, placements, creatives
- `AdvertisingCampaignReadinessCheck` — deterministic validation results
- `AdvertisingCampaignApproval` — separated approval types
- `AdvertisingCampaignProviderDraft` — provider validation placeholder (no publish)

## API

`GET/POST /api/brands/[brandId]/advertising/plans`

`GET/POST /api/brands/[brandId]/advertising/plans/[planId]` with actions:

- `generate`, `readiness`, `add-channel`, `add-budget`, `add-audience`, `add-conversion`, `add-destination`, `attach-creative`, `request-approval`, `approve`, `submit-review`

## UI routes

- `/advertising` — overview
- `/advertising/plans` — list
- `/advertising/plans/new` — create
- `/advertising/plans/[planId]/*` — strategy, audiences, budget, creatives, tracking, review, readiness

## Permissions

`advertisingPlans.read|create|edit|archive|approveStrategy|approveBudget|approveCreative|approveCompliance|approveLaunch`

## Related docs

- [Objectives](./ADVERTISING_OBJECTIVES.md)
- [Budget governance](./ADVERTISING_BUDGET_GOVERNANCE.md)
- [Audiences](./ADVERTISING_AUDIENCES.md)
- [Readiness](./ADVERTISING_READINESS.md)
- [Approvals](./ADVERTISING_APPROVALS.md)
- [Pre-flight audit](./TASK_5_1_PREFLIGHT.md)
