# Onboarding

Task 1.4 delivers an eight-step, resumable onboarding flow for new workspace setup.

## Steps

| Step | Key | Required fields |
| --- | --- | --- |
| 1. Account profile | `ACCOUNT_PROFILE` | Timezone |
| 2. Organisation details | `ORGANISATION` | Organisation name and slug |
| 3. First project | `PROJECT` | Project name and slug |
| 4. First brand | `BRAND` | Brand name and slug |
| 5. Brand profile | `BRAND_PROFILE` | Recommended essential profile fields |
| 6. Marketing objectives | `MARKETING_OBJECTIVES` | At least one objective with target value and period |
| 7. Channel preferences | `CHANNEL_PREFERENCES` | At least one planned channel |
| 8. Review and completion | `REVIEW` | Completed workspace context |

## Resilience

- Progress is stored in `OnboardingProgress` after each completed step.
- `completedSteps` and `currentStep` allow safe resume after browser close.
- Back navigation updates the current step without deleting created records.
- Duplicate submissions update existing records instead of creating new organisations, projects, or brands.
- Marketing objectives and channel preferences use upsert/delete-sync patterns per brand.

## Cresco internal template

Internal teams can explicitly apply the Cresco template from the organisation step. This creates:

- Organisation: Cresco Group
- Projects and brands:
  - Cresco Grants Intelligence
  - Capital Cresco Terminal

The template is never applied by default for external customers.

## API

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/onboarding` | GET | Hydrate onboarding state |
| `/api/onboarding` | PUT | Save or go back one step |
| `/api/onboarding` | POST | Apply template or switch project/brand context |

## Dashboard entry

After completion:

- Current organisation, project, and brand are selected in workspace preferences.
- Dashboard shows real configuration state only.
- Brand profile completeness is displayed.
- Recommended next action: **Connect a marketing channel**.

## Models

- `OnboardingProgress`
- `MarketingObjective`
- `BrandChannelPreference`

No fake performance data is created during onboarding.
