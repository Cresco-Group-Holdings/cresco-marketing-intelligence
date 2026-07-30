# AI Advertising Optimisation

Task 5.9 introduces an evidence-grounded AI optimisation agent that analyses advertising performance and proposes controlled optimisation actions.

## Principles

1. **No autonomous material actions** — the agent never launches campaigns, increases budgets, or applies material targeting changes without human approval.
2. **Evidence-first** — every run includes a complete evidence package (see [AD_OPTIMISATION_EVIDENCE.md](./AD_OPTIMISATION_EVIDENCE.md)).
3. **Guardrailed analysis** — stale data, low volume, attribution mismatches, and active experiments trigger warnings or suppression (see [AD_OPTIMISATION_GUARDRAILS.md](./AD_OPTIMISATION_GUARDRAILS.md)).
4. **Feedback loop** — user feedback and measured outcomes are tracked; success is never claimed without post-change evidence.

## Models

| Model | Purpose |
|-------|---------|
| `AdvertisingOptimisationRun` | Review execution (daily/weekly/monthly/on-demand) |
| `AdvertisingOptimisationEvidence` | Evidence package for a run |
| `AdvertisingOptimisationFinding` | Detected performance issues or strengths |
| `AdvertisingOptimisationRecommendation` | Proposed optimisation with confidence metadata |
| `AdvertisingOptimisationActionProposal` | Classified action requiring approval |
| `AdvertisingOptimisationApproval` | Human approval audit trail |
| `AdvertisingOptimisationOutcome` | Measured post-change results |
| `AdvertisingOptimisationFeedback` | User acceptance/rejection/deferral |

## Review Types

- `DAILY_OPERATIONAL` — daily operational review
- `WEEKLY_OPTIMISATION` — weekly optimisation review
- `MONTHLY_PORTFOLIO` — monthly portfolio review
- `ON_DEMAND_CAMPAIGN` — on-demand campaign review

## Analysis Inputs

Campaign structure, provider metrics, spend, conversions, revenue, attribution, funnel, creative, audience, experiment results, budget pacing, data quality, provider freshness, landing-page performance.

## API

- `GET /api/brands/[brandId]/advertising/optimisation` — list runs
- `POST` action `startRun` — execute optimisation review
- `GET /api/brands/[brandId]/advertising/optimisation/[recommendationId]` — recommendation detail
- `POST` actions: `approveAction`, `submitFeedback`, `recordOutcome`

## Permissions

- `advertisingOptimisation.read` — view runs, findings, recommendations
- `advertisingOptimisation.run` — start optimisation reviews
- `advertisingOptimisation.approve` — approve action proposals
- `advertisingOptimisation.feedback` — submit feedback and record outcomes

## UI Routes

- `/advertising/optimisation` — overview and start reviews
- `/advertising/optimisation/findings`
- `/advertising/optimisation/recommendations`
- `/advertising/optimisation/history`
- `/advertising/optimisation/[recommendationId]` — detail with evidence, confidence, approval

## Related Documentation

- [AD_OPTIMISATION_EVIDENCE.md](./AD_OPTIMISATION_EVIDENCE.md)
- [AD_OPTIMISATION_GUARDRAILS.md](./AD_OPTIMISATION_GUARDRAILS.md)
- [AD_OPTIMISATION_ACTIONS.md](./AD_OPTIMISATION_ACTIONS.md)
