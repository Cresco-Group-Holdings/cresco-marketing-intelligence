# Advertising Experiments

Rigorous advertising experiment system for comparing creatives, audiences, offers, landing pages, and campaign configurations.

## Models

- `AdvertisingExperiment` — main experiment entity
- `AdvertisingExperimentVersion` — design version history
- `AdvertisingExperimentHypothesis` — required measurable hypothesis
- `AdvertisingExperimentVariant` — control, treatment, multi-variant
- `AdvertisingExperimentAllocation` — planned traffic split
- `AdvertisingExperimentMetric` — primary, guardrail, secondary metrics
- `AdvertisingExperimentObservation` — time-series metric observations
- `AdvertisingExperimentResult` — computed analysis results
- `AdvertisingExperimentValidityCheck` — validity warnings and critical issues
- `AdvertisingExperimentDecision` — human-approved outcomes

## Statuses

`DRAFT` → `READY` → `RUNNING` → `COMPLETED` / `INCONCLUSIVE` / `PAUSED` / `CANCELLED` / `ARCHIVED`

## Experiment types

Supported: CREATIVE, HEADLINE, COPY, CTA, AUDIENCE, LANDING_PAGE, OFFER, PLACEMENT

Feature-flagged (read-only): BIDDING_STRATEGY, BUDGET_ALLOCATION, CAMPAIGN_STRUCTURE

## Flow

1. Design experiment with measurable hypothesis
2. Define variants with documented variables
3. Set allocation plan
4. Mark ready → start → record observations
5. Run validity checks → analyze → record decision
6. Human approval required before adopting winner

## API

- `GET/POST /api/brands/[brandId]/advertising/experiments`
- `GET/POST /api/brands/[brandId]/advertising/experiments/[experimentId]`

## UI

- `/advertising/experiments`
- `/advertising/experiments/new`
- `/advertising/experiments/[experimentId]`
- `/advertising/experiments/[experimentId]/results`
- `/advertising/experiments/[experimentId]/validity`

## Key principle

Teams can design and evaluate advertising tests without misrepresenting weak or invalid evidence.
